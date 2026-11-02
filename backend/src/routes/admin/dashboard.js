// Panel → Dashboard: indicadores de ventas, pedidos pendientes, stock bajo y top de productos
import { Router } from 'express';
import { db } from '../../db/index.js';

const r = Router();
const VALID = "o.status <> 'cancelado'";
const TZ = "'America/Caracas'";

r.get('/', async (_req, res) => {
  // Ventas por período en hora de Venezuela
  const sales = await db.one(
    `SELECT
       COALESCE(SUM(total) FILTER (WHERE (created_at AT TIME ZONE ${TZ})::date = (NOW() AT TIME ZONE ${TZ})::date), 0) AS today,
       COUNT(*)            FILTER (WHERE (created_at AT TIME ZONE ${TZ})::date = (NOW() AT TIME ZONE ${TZ})::date) AS today_orders,
       COALESCE(SUM(total) FILTER (WHERE created_at >= date_trunc('week', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}), 0) AS week,
       COALESCE(SUM(total) FILTER (WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}), 0) AS month,
       COUNT(*)            FILTER (WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}) AS month_orders,
       COALESCE(SUM(total) FILTER (WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ} - INTERVAL '1 month'
                                    AND created_at <  date_trunc('month', NOW() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}), 0) AS prev_month
     FROM orders o WHERE ${VALID}`
  );
  const [pending, lowStock, top, daily, byCategory, recent] = await Promise.all([
    db.one(`SELECT COUNT(*) FILTER (WHERE status = 'pendiente') AS pendiente,
                   COUNT(*) FILTER (WHERE status = 'pagado') AS pagado,
                   COUNT(*) FILTER (WHERE status = 'preparacion') AS preparacion,
                   COUNT(*) FILTER (WHERE status = 'enviado') AS enviado FROM orders`),
    db.many(`SELECT id, sku, name, stock, min_stock FROM products WHERE active AND stock <= min_stock ORDER BY stock, name LIMIT 8`),
    db.many(
      `SELECT oi.product_id, oi.name, SUM(oi.quantity) AS qty, SUM(oi.total) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE ${VALID} AND o.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY oi.product_id, oi.name ORDER BY qty DESC LIMIT 6`
    ),
    // Ingresos y utilidad de los últimos 30 días (incluye días sin ventas)
    db.many(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day,
              COALESCE((SELECT SUM(o.total) FROM orders o WHERE ${VALID} AND (o.created_at AT TIME ZONE ${TZ})::date = d), 0) AS revenue,
              COALESCE((SELECT SUM(oi.total - oi.unit_cost * oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                        WHERE ${VALID} AND (o.created_at AT TIME ZONE ${TZ})::date = d), 0) AS profit
       FROM generate_series((NOW() AT TIME ZONE ${TZ})::date - 29, (NOW() AT TIME ZONE ${TZ})::date, INTERVAL '1 day') AS g(d)
       ORDER BY d`
    ),
    db.many(
      `SELECT COALESCE(c.name, 'Sin categoría') AS name, SUM(oi.total) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${VALID} AND o.created_at >= NOW() - INTERVAL '30 days' GROUP BY c.name ORDER BY revenue DESC`
    ),
    db.many(`SELECT id, code, customer_name, status, total, created_at FROM orders ORDER BY created_at DESC LIMIT 6`),
  ]);
  res.json({ sales, pending, low_stock: lowStock, top_products: top, daily, by_category: byCategory, recent_orders: recent });
});

export default r;
