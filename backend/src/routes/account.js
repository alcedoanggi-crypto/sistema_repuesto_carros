// Cuenta del cliente: direcciones, vehículos guardados (garaje), lista de deseos y pedidos
import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notFound, HttpError } from '../utils/errors.js';
import { withPrices } from '../services/pricing.js';
import { PRODUCT_SELECT } from '../services/catalog.js';
import { orderDetail, changeStatus } from '../services/orders.js';

const r = Router();
r.use(requireAuth);

// ---------- Direcciones ----------
const ADDRESS_RULES = {
  recipient: 'required|minlen:3', phone: 'required|phone', state: 'required',
  city: 'required', line: 'required|minlen:5|maxlen:250', label: 'maxlen:60',
};
const ADDRESS_LABELS = { recipient: 'Quien recibe', phone: 'Teléfono', state: 'Estado', city: 'Ciudad', line: 'Dirección' };

r.get('/addresses', async (req, res) => {
  res.json(await db.many('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id', [req.user.id]));
});

r.post('/addresses', validate(ADDRESS_RULES, ADDRESS_LABELS), async (req, res) => {
  const b = req.body;
  const isFirst = !(await db.one('SELECT 1 FROM addresses WHERE user_id = $1', [req.user.id]));
  const makeDefault = isFirst || !!b.is_default;
  if (makeDefault) await db.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
  const a = await db.one(
    `INSERT INTO addresses (user_id, label, recipient, phone, state, city, line, reference, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, b.label || 'Principal', b.recipient, b.phone, b.state, b.city, b.line, b.reference || null, makeDefault]
  );
  res.status(201).json(a);
});

r.put('/addresses/:id', validate(ADDRESS_RULES, ADDRESS_LABELS), async (req, res) => {
  const b = req.body;
  if (b.is_default) await db.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
  const a = await db.one(
    `UPDATE addresses SET label=$1, recipient=$2, phone=$3, state=$4, city=$5, line=$6, reference=$7,
       is_default = CASE WHEN $8 THEN TRUE ELSE is_default END
     WHERE id = $9 AND user_id = $10 RETURNING *`,
    [b.label || 'Principal', b.recipient, b.phone, b.state, b.city, b.line, b.reference || null, !!b.is_default, Number(req.params.id), req.user.id]
  );
  if (!a) throw notFound('Dirección');
  res.json(a);
});

r.delete('/addresses/:id', async (req, res) => {
  await db.query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [Number(req.params.id), req.user.id]);
  res.status(204).end();
});

// ---------- Mi garaje (vehículos guardados) ----------
r.get('/vehicles', async (req, res) => {
  res.json(await db.many(
    `SELECT sv.id, sv.nickname, v.id AS vehicle_id, v.year, v.engine, md.name AS model, mk.name AS make,
            md.id AS model_id, mk.id AS make_id
     FROM saved_vehicles sv JOIN vehicles v ON v.id = sv.vehicle_id
     JOIN vehicle_models md ON md.id = v.model_id JOIN vehicle_makes mk ON mk.id = md.make_id
     WHERE sv.user_id = $1 ORDER BY sv.id`, [req.user.id]
  ));
});

r.post('/vehicles', validate({ vehicle_id: 'required|int', nickname: 'maxlen:60' }), async (req, res) => {
  if (!(await db.one('SELECT 1 FROM vehicles WHERE id = $1', [Number(req.body.vehicle_id)]))) throw notFound('Vehículo');
  const row = await db.one(
    `INSERT INTO saved_vehicles (user_id, vehicle_id, nickname) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, vehicle_id) DO UPDATE SET nickname = COALESCE(EXCLUDED.nickname, saved_vehicles.nickname)
     RETURNING *`,
    [req.user.id, Number(req.body.vehicle_id), req.body.nickname || null]
  );
  res.status(201).json(row);
});

r.delete('/vehicles/:id', async (req, res) => {
  await db.query('DELETE FROM saved_vehicles WHERE id = $1 AND user_id = $2', [Number(req.params.id), req.user.id]);
  res.status(204).end();
});

// ---------- Lista de deseos ----------
r.get('/wishlist', async (req, res) => {
  const rows = await db.many(
    `${PRODUCT_SELECT} JOIN wishlist w ON w.product_id = p.id WHERE w.user_id = $1 ORDER BY w.created_at DESC`, [req.user.id]
  );
  res.json(await withPrices(rows, req.user));
});

r.post('/wishlist/:productId', async (req, res) => {
  await db.query('INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.user.id, Number(req.params.productId)]);
  res.status(201).json({ ok: true });
});

r.delete('/wishlist/:productId', async (req, res) => {
  await db.query('DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2', [req.user.id, Number(req.params.productId)]);
  res.status(204).end();
});

// ---------- Pedidos del cliente ----------
r.get('/orders', async (req, res) => {
  res.json(await db.many(
    `SELECT o.id, o.code, o.status, o.total, o.delivery_type, o.created_at, o.tracking_number, o.carrier,
            (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [req.user.id]
  ));
});

r.get('/orders/:code', async (req, res) => {
  const o = await orderDetail({ code: req.params.code });
  if (!o || o.user_id !== req.user.id) throw notFound('Pedido');
  res.json(o);
});

/** El cliente puede cancelar un pedido mientras siga pendiente de pago */
r.post('/orders/:code/cancel', async (req, res) => {
  const o = await db.one('SELECT id, user_id, status FROM orders WHERE code = $1', [req.params.code]);
  if (!o || o.user_id !== req.user.id) throw notFound('Pedido');
  if (o.status !== 'pendiente') throw new HttpError(400, 'Solo se pueden cancelar pedidos pendientes de pago');
  await changeStatus(o.id, 'cancelado', { userId: req.user.id, note: 'Cancelado por el cliente' });
  res.json(await orderDetail({ id: o.id }));
});

export default r;
