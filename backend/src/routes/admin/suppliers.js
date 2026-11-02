// Panel → Proveedores y órdenes de compra (al recibir una orden entra el stock)
import { Router } from 'express';
import { db } from '../../db/index.js';
import { check } from '../../middleware/validate.js';
import { HttpError, notFound } from '../../utils/errors.js';
import { code, money } from '../../utils/helpers.js';
import { crud } from '../../utils/crud.js';
import { moveStock } from '../../services/orders.js';

const r = Router();

// ---------- Proveedores (CRUD genérico) ----------
r.use('/suppliers', crud({
  table: 'suppliers',
  fields: ['name', 'rif', 'contact', 'phone', 'email', 'address', 'notes', 'active'],
  rules: { name: 'required|minlen:3|maxlen:120', rif: 'docid', email: 'email', phone: 'phone' },
  labels: { name: 'Razón social', rif: 'RIF', email: 'Correo', phone: 'Teléfono' },
  orderBy: 'name',
  prepare: (b) => ({ ...b, rif: b.rif?.toUpperCase(), active: b.active ?? true }),
}));

// ---------- Órdenes de compra ----------
r.get('/purchase-orders', async (req, res) => {
  const params = [];
  let w = '';
  if (req.query.status) { params.push(req.query.status); w = 'WHERE po.status = $1'; }
  res.json(await db.many(
    `SELECT po.*, s.name AS supplier_name, u.name AS created_by_name,
            (SELECT COUNT(*) FROM purchase_order_items i WHERE i.po_id = po.id) AS item_count
     FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id LEFT JOIN users u ON u.id = po.created_by
     ${w} ORDER BY po.created_at DESC`, params
  ));
});

r.get('/purchase-orders/:id', async (req, res) => {
  const po = await db.one(
    `SELECT po.*, s.name AS supplier_name, s.rif AS supplier_rif, s.phone AS supplier_phone, s.email AS supplier_email
     FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = $1`, [Number(req.params.id)]
  );
  if (!po) throw notFound('Orden de compra');
  po.items = await db.many(
    `SELECT i.*, p.name, p.sku, p.stock FROM purchase_order_items i JOIN products p ON p.id = i.product_id WHERE i.po_id = $1 ORDER BY i.id`,
    [po.id]
  );
  res.json(po);
});

function validatePO(b) {
  check(b, { supplier_id: 'required|int' }, { supplier_id: 'Proveedor' });
  if (!Array.isArray(b.items) || !b.items.length) throw new HttpError(422, 'Agrega al menos un producto a la orden');
  b.items.forEach((it, i) => check(it, { product_id: 'required|int', quantity: 'required|int|min:1', unit_cost: 'required|number|min:0' },
    { product_id: `Producto #${i + 1}`, quantity: `Cantidad #${i + 1}`, unit_cost: `Costo #${i + 1}` }));
}

async function saveItems(t, poId, items) {
  await t.query('DELETE FROM purchase_order_items WHERE po_id = $1', [poId]);
  let total = 0;
  for (const it of items) {
    await t.query('INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_cost) VALUES ($1, $2, $3, $4)',
      [poId, Number(it.product_id), Number(it.quantity), Number(it.unit_cost)]);
    total += Number(it.quantity) * Number(it.unit_cost);
  }
  await t.query('UPDATE purchase_orders SET total = $1 WHERE id = $2', [money(total), poId]);
}

r.post('/purchase-orders', async (req, res) => {
  validatePO(req.body);
  const id = await db.tx(async (t) => {
    const { rows: [po] } = await t.query(
      'INSERT INTO purchase_orders (supplier_id, notes, created_by) VALUES ($1, $2, $3) RETURNING id',
      [Number(req.body.supplier_id), req.body.notes || null, req.user.id]
    );
    await t.query('UPDATE purchase_orders SET code = $1 WHERE id = $2', [code('OC', po.id), po.id]);
    await saveItems(t, po.id, req.body.items);
    return po.id;
  });
  res.status(201).json({ id });
});

r.put('/purchase-orders/:id', async (req, res) => {
  validatePO(req.body);
  const id = Number(req.params.id);
  await db.tx(async (t) => {
    const po = (await t.query('SELECT status FROM purchase_orders WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!po) throw new HttpError(404, 'Orden de compra no encontrada');
    if (!['borrador', 'enviada'].includes(po.status)) throw new HttpError(400, 'Solo se pueden editar órdenes en borrador o enviadas');
    await t.query('UPDATE purchase_orders SET supplier_id = $1, notes = $2 WHERE id = $3', [Number(req.body.supplier_id), req.body.notes || null, id]);
    await saveItems(t, id, req.body.items);
  });
  res.json({ id });
});

/** Cambia el estado. Al pasar a "recibida" entra la mercancía al inventario y se actualiza el costo */
r.post('/purchase-orders/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status;
  const allowed = { borrador: ['enviada', 'cancelada'], enviada: ['recibida', 'cancelada'] };
  await db.tx(async (t) => {
    const po = (await t.query('SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!po) throw new HttpError(404, 'Orden de compra no encontrada');
    if (!(allowed[po.status] || []).includes(status)) throw new HttpError(400, `No se puede pasar de "${po.status}" a "${status}"`);
    if (status === 'recibida') {
      const items = (await t.query('SELECT * FROM purchase_order_items WHERE po_id = $1', [id])).rows;
      for (const it of items) {
        await moveStock(t, { productId: it.product_id, qty: it.quantity, type: 'compra', reason: 'Recepción de orden de compra', reference: po.code, userId: req.user.id });
        await t.query('UPDATE products SET cost_price = $1 WHERE id = $2', [it.unit_cost, it.product_id]);
      }
    }
    await t.query(`UPDATE purchase_orders SET status = $1, received_at = CASE WHEN $2 THEN NOW() ELSE received_at END WHERE id = $3`,
      [status, status === 'recibida', id]);
  });
  res.json({ id, status });
});

export default r;
