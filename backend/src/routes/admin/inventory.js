// Panel → Inventario: entradas, salidas, ajustes, alertas de stock bajo e historial
import { Router } from 'express';
import { db } from '../../db/index.js';
import { check } from '../../middleware/validate.js';
import { HttpError } from '../../utils/errors.js';
import { paginate } from '../../utils/helpers.js';
import { moveStock } from '../../services/orders.js';

const r = Router();

/** Historial de movimientos con filtros por producto, tipo y fechas */
r.get('/movements', async (req, res) => {
  const { limit, offset, page } = paginate(req.query, 30);
  const params = [];
  const where = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  if (req.query.product_id) where.push(`m.product_id = ${p(Number(req.query.product_id))}`);
  if (req.query.type) where.push(`m.type = ${p(req.query.type)}`);
  if (req.query.from) where.push(`m.created_at >= ${p(req.query.from)}::date`);
  if (req.query.to) where.push(`m.created_at < (${p(req.query.to)}::date + 1)`);
  if (req.query.q) where.push(`(pr.name ILIKE ${p('%' + req.query.q + '%')} OR pr.sku ILIKE $${params.length})`);
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const items = await db.many(
    `SELECT m.*, pr.name AS product_name, pr.sku, u.name AS user_name
     FROM inventory_movements m JOIN products pr ON pr.id = m.product_id LEFT JOIN users u ON u.id = m.user_id
     ${w} ORDER BY m.created_at DESC, m.id DESC LIMIT ${limit} OFFSET ${offset}`, params
  );
  const { count } = await db.one(`SELECT COUNT(*) AS count FROM inventory_movements m JOIN products pr ON pr.id = m.product_id ${w}`, params);
  res.json({ items, total: count, page, pages: Math.max(Math.ceil(count / limit), 1) });
});

/**
 * Registra un movimiento manual.
 * - entrada / salida: cantidad positiva (la salida se resta)
 * - ajuste: se indica el stock real contado y se calcula la diferencia
 */
r.post('/movements', async (req, res) => {
  const b = req.body;
  check(b, { product_id: 'required|int', type: 'required|in:entrada,salida,ajuste', quantity: 'required|int|min:0', reason: 'required|minlen:3|maxlen:250' },
    { product_id: 'Producto', type: 'Tipo', quantity: 'Cantidad', reason: 'Motivo' });
  const stock = await db.tx(async (t) => {
    const prod = (await t.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [Number(b.product_id)])).rows[0];
    if (!prod) throw new HttpError(404, 'Producto no encontrado');
    let qty = Number(b.quantity);
    if (b.type === 'salida') {
      if (qty > prod.stock) throw new HttpError(422, 'Revisa los datos del formulario', { quantity: `Solo hay ${prod.stock} unidades` });
      qty = -qty;
    }
    if (b.type === 'ajuste') qty = Number(b.quantity) - prod.stock;
    if (qty === 0) throw new HttpError(422, 'Revisa los datos del formulario', { quantity: b.type === 'ajuste' ? 'El stock contado es igual al actual' : 'La cantidad debe ser mayor a 0' });
    return moveStock(t, { productId: Number(b.product_id), qty, type: b.type, reason: b.reason, reference: b.reference, userId: req.user.id });
  });
  res.status(201).json({ stock });
});

/** Productos con stock en o por debajo del mínimo */
r.get('/low-stock', async (_req, res) => {
  res.json(await db.many(
    `SELECT p.id, p.sku, p.name, p.stock, p.min_stock, p.warehouse_location, b.name AS brand_name,
            GREATEST(p.min_stock * 2 - p.stock, 1) AS suggested_order
     FROM products p LEFT JOIN part_brands b ON b.id = p.brand_id
     WHERE p.active AND p.stock <= p.min_stock ORDER BY (p.stock::float / GREATEST(p.min_stock, 1)), p.name`
  ));
});

export default r;
