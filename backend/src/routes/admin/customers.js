// Panel → Clientes: listado, historial de compras y tipo de cliente (precios diferenciados)
import { Router } from 'express';
import { db } from '../../db/index.js';
import { check } from '../../middleware/validate.js';
import { notFound } from '../../utils/errors.js';
import { paginate } from '../../utils/helpers.js';

const r = Router();

r.get('/', async (req, res) => {
  const { limit, offset, page } = paginate(req.query, 25);
  const params = [];
  const where = ["u.role = 'cliente'"];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  if (req.query.type) where.push(`u.customer_type = ${p(req.query.type)}`);
  if (req.query.q) {
    const q = p(`%${req.query.q}%`);
    where.push(`(u.name ILIKE ${q} OR u.email ILIKE ${q} OR u.doc_id ILIKE ${q})`);
  }
  const w = 'WHERE ' + where.join(' AND ');
  const items = await db.many(
    `SELECT u.id, u.name, u.email, u.doc_id, u.phone, u.customer_type, u.active, u.created_at,
            COUNT(o.id) FILTER (WHERE o.status <> 'cancelado') AS orders,
            COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelado'), 0) AS spent,
            MAX(o.created_at) AS last_order
     FROM users u LEFT JOIN orders o ON o.user_id = u.id
     ${w} GROUP BY u.id ORDER BY spent DESC, u.name LIMIT ${limit} OFFSET ${offset}`, params
  );
  const { count } = await db.one(`SELECT COUNT(*) AS count FROM users u ${w}`, params);
  res.json({ items, total: count, page, pages: Math.max(Math.ceil(count / limit), 1) });
});

r.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const u = await db.one(
    `SELECT id, name, email, doc_id, phone, customer_type, active, created_at FROM users WHERE id = $1 AND role = 'cliente'`, [id]
  );
  if (!u) throw notFound('Cliente');
  const [orders, addresses, vehicles, top] = await Promise.all([
    db.many('SELECT id, code, status, total, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [id]),
    db.many('SELECT * FROM addresses WHERE user_id = $1', [id]),
    db.many(
      `SELECT mk.name AS make, md.name AS model, v.year, v.engine FROM saved_vehicles sv JOIN vehicles v ON v.id = sv.vehicle_id
       JOIN vehicle_models md ON md.id = v.model_id JOIN vehicle_makes mk ON mk.id = md.make_id WHERE sv.user_id = $1`, [id]
    ),
    db.many(
      `SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.total) AS total FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = $1 AND o.status <> 'cancelado' GROUP BY oi.name ORDER BY qty DESC LIMIT 5`, [id]
    ),
  ]);
  res.json({ ...u, orders, addresses, vehicles, top_products: top });
});

/** Cambia tipo de cliente (normal/taller/mayorista) o lo activa/desactiva */
r.put('/:id', async (req, res) => {
  check(req.body, { customer_type: 'required|in:normal,taller,mayorista' }, { customer_type: 'Tipo de cliente' });
  const u = await db.one(
    `UPDATE users SET customer_type = $1, active = COALESCE($2, active) WHERE id = $3 AND role = 'cliente'
     RETURNING id, customer_type, active`,
    [req.body.customer_type, req.body.active ?? null, Number(req.params.id)]
  );
  if (!u) throw notFound('Cliente');
  res.json(u);
});

export default r;
