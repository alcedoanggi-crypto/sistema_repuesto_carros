// Panel → Pedidos: listado con filtros, detalle, cambio de estado y datos de envío
import { Router } from 'express';
import { db } from '../../db/index.js';
import { notFound } from '../../utils/errors.js';
import { paginate } from '../../utils/helpers.js';
import { orderDetail, changeStatus } from '../../services/orders.js';

const r = Router();

r.get('/', async (req, res) => {
  const { limit, offset, page } = paginate(req.query, 20);
  const params = [];
  const where = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  if (req.query.status) where.push(`o.status = ${p(req.query.status)}`);
  if (req.query.delivery_type) where.push(`o.delivery_type = ${p(req.query.delivery_type)}`);
  if (req.query.payment_method) where.push(`o.payment_method = ${p(req.query.payment_method)}`);
  if (req.query.from) where.push(`o.created_at >= ${p(req.query.from)}::date`);
  if (req.query.to) where.push(`o.created_at < (${p(req.query.to)}::date + 1)`);
  if (req.query.q) {
    const q = p(`%${req.query.q}%`);
    where.push(`(o.code ILIKE ${q} OR o.customer_name ILIKE ${q} OR o.customer_doc ILIKE ${q} OR o.customer_email ILIKE ${q})`);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const items = await db.many(
    `SELECT o.id, o.code, o.customer_name, o.customer_type, o.status, o.total, o.delivery_type, o.payment_method,
            o.payment_reference, o.created_at, pm.name AS payment_method_name
     FROM orders o LEFT JOIN payment_methods pm ON pm.code = o.payment_method
     ${w} ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}`, params
  );
  const { count } = await db.one(`SELECT COUNT(*) AS count FROM orders o ${w}`, params);
  const counts = await db.many('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
  res.json({ items, total: count, page, pages: Math.max(Math.ceil(count / limit), 1), counts });
});

r.get('/:id', async (req, res) => {
  const o = await orderDetail({ id: Number(req.params.id) });
  if (!o) throw notFound('Pedido');
  res.json(o);
});

/** { status, note, carrier, tracking_number } */
r.post('/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  await changeStatus(id, req.body.status, {
    userId: req.user.id, note: req.body.note, carrier: req.body.carrier, tracking: req.body.tracking_number,
  });
  res.json(await orderDetail({ id }));
});

/** Actualiza solo la guía de envío o notas internas */
r.put('/:id/shipping', async (req, res) => {
  const id = Number(req.params.id);
  await db.query('UPDATE orders SET carrier = $1, tracking_number = $2, updated_at = NOW() WHERE id = $3',
    [req.body.carrier || null, req.body.tracking_number || null, id]);
  res.json(await orderDetail({ id }));
});

export default r;
