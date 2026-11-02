// Lógica de pedidos compartida entre la tienda y el panel:
// creación (con descuento de stock), detalle y cambios de estado.
import { db } from '../db/index.js';
import { HttpError } from '../utils/errors.js';
import { code } from '../utils/helpers.js';
import { quoteCart } from './pricing.js';

export const STATUSES = ['pendiente', 'pagado', 'preparacion', 'enviado', 'entregado', 'cancelado'];
export const STATUS_LABELS = {
  pendiente: 'Pendiente de pago', pagado: 'Pagado', preparacion: 'En preparación',
  enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
};

// Transiciones válidas para que el flujo del pedido sea coherente
const TRANSITIONS = {
  pendiente: ['pagado', 'cancelado'],
  pagado: ['preparacion', 'cancelado'],
  preparacion: ['enviado', 'entregado', 'cancelado'], // entregado directo si es retiro en tienda
  enviado: ['entregado'],
  entregado: [],
  cancelado: [],
};
export const nextStatuses = (s) => TRANSITIONS[s] || [];

/** Registra un movimiento de inventario y actualiza el stock del producto */
export async function moveStock(q, { productId, qty, type, reason, reference, userId }) {
  const { rows } = await q.query(
    'UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2 RETURNING stock',
    [qty, productId]
  );
  if (!rows[0]) throw new HttpError(404, 'Producto no encontrado');
  if (rows[0].stock < 0) throw new HttpError(400, 'El movimiento dejaría el stock en negativo');
  await q.query(
    `INSERT INTO inventory_movements (product_id, type, quantity, stock_after, reason, reference, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [productId, type, qty, rows[0].stock, reason || null, reference || null, userId || null]
  );
  return rows[0].stock;
}

/** Crea el pedido en una sola transacción: recalcula precios, valida stock y cupón, descuenta inventario */
export async function createOrder(input, user) {
  return db.tx(async (t) => {
    const quote = await quoteCart(input, user, t, { lock: true });
    if (quote.problems.length) throw new HttpError(409, quote.problems[0].error, { problems: quote.problems });
    if (quote.delivery_type === 'envio' && !quote.zone) throw new HttpError(422, 'Selecciona la zona de envío');

    const method = (await t.query('SELECT * FROM payment_methods WHERE code = $1 AND active', [input.payment_method])).rows[0];
    if (!method) throw new HttpError(422, 'Selecciona un método de pago válido', { payment_method: 'Método no válido' });
    if (method.requires_reference && !String(input.payment_reference || '').trim()) {
      throw new HttpError(422, 'Indica el número de referencia del pago', { payment_reference: 'Obligatorio para este método' });
    }

    const c = input.customer;
    const { rows: [order] } = await t.query(
      `INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, customer_doc, customer_type,
         delivery_type, shipping_zone_id, shipping_address, payment_method, payment_reference,
         subtotal, discount, shipping_cost, tax, total, coupon_code, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [user.id, c.name, c.email, c.phone, c.doc_id.toUpperCase(), quote.customer_type,
       quote.delivery_type, quote.zone?.id || null,
       quote.delivery_type === 'envio' ? JSON.stringify(input.address) : null,
       method.code, input.payment_reference?.trim() || null,
       quote.subtotal, quote.discount, quote.shipping_cost, quote.tax, quote.total, quote.coupon, input.notes || null]
    );
    const orderCode = code('MAC', order.id);
    await t.query('UPDATE orders SET code = $1 WHERE id = $2', [orderCode, order.id]);

    for (const l of quote.lines) {
      await t.query(
        `INSERT INTO order_items (order_id, product_id, name, sku, quantity, unit_price, unit_cost, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [order.id, l.product_id, l.name, l.sku, l.quantity, l.unit_price, l.unit_cost, l.total]
      );
      await moveStock(t, { productId: l.product_id, qty: -l.quantity, type: 'venta', reason: 'Venta en tienda en línea', reference: orderCode, userId: user.id });
      await t.query('UPDATE products SET sold_count = sold_count + $1 WHERE id = $2', [l.quantity, l.product_id]);
    }
    if (quote.coupon) await t.query('UPDATE coupons SET used_count = used_count + 1 WHERE code = $1', [quote.coupon]);
    await t.query(
      'INSERT INTO order_status_history (order_id, status, note, user_id) VALUES ($1, $2, $3, $4)',
      [order.id, 'pendiente', method.requires_reference ? 'Pago reportado, en verificación' : 'Pedido recibido', user.id]
    );
    return { id: order.id, code: orderCode };
  });
}

/** Detalle completo del pedido con items, historial y datos de la zona */
export async function orderDetail({ id, code: c }) {
  const o = await db.one(
    `SELECT o.*, z.name AS zone_name, z.est_days, pm.name AS payment_method_name, pm.instructions AS payment_instructions
     FROM orders o LEFT JOIN shipping_zones z ON z.id = o.shipping_zone_id
     LEFT JOIN payment_methods pm ON pm.code = o.payment_method
     WHERE ${id ? 'o.id = $1' : 'o.code = $1'}`, [id ?? c]
  );
  if (!o) return null;
  const [items, history] = await Promise.all([
    db.many(
      `SELECT oi.*, p.slug, p.images FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 ORDER BY oi.id`, [o.id]
    ),
    db.many(
      `SELECT h.*, u.name AS user_name FROM order_status_history h LEFT JOIN users u ON u.id = h.user_id
       WHERE h.order_id = $1 ORDER BY h.created_at, h.id`, [o.id]
    ),
  ]);
  return { ...o, items, history, next_statuses: nextStatuses(o.status) };
}

/** Cambia el estado validando la transición. Al cancelar, devuelve el stock. */
export async function changeStatus(orderId, status, { userId, note, carrier, tracking } = {}) {
  if (!STATUSES.includes(status)) throw new HttpError(422, 'Estado no válido');
  return db.tx(async (t) => {
    const o = (await t.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0];
    if (!o) throw new HttpError(404, 'Pedido no encontrado');
    if (!nextStatuses(o.status).includes(status)) {
      throw new HttpError(400, `No se puede pasar de "${STATUS_LABELS[o.status]}" a "${STATUS_LABELS[status]}"`);
    }
    if (status === 'enviado' && o.delivery_type === 'envio' && !tracking && !o.tracking_number) {
      throw new HttpError(422, 'Indica la empresa de envío y el número de guía', { tracking_number: 'Obligatorio al marcar como enviado' });
    }
    if (status === 'cancelado') {
      const items = (await t.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId])).rows;
      for (const it of items) {
        if (!it.product_id) continue;
        await moveStock(t, { productId: it.product_id, qty: it.quantity, type: 'devolucion', reason: 'Pedido cancelado', reference: o.code, userId });
        await t.query('UPDATE products SET sold_count = GREATEST(sold_count - $1, 0) WHERE id = $2', [it.quantity, it.product_id]);
      }
    }
    await t.query(
      `UPDATE orders SET status = $1, updated_at = NOW(),
         carrier = COALESCE($2, carrier), tracking_number = COALESCE($3, tracking_number) WHERE id = $4`,
      [status, carrier || null, tracking || null, orderId]
    );
    await t.query(
      'INSERT INTO order_status_history (order_id, status, note, user_id) VALUES ($1, $2, $3, $4)',
      [orderId, status, note || null, userId || null]
    );
  });
}
