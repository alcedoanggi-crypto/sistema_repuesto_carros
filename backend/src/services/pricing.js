// Reglas de precio y cálculo de totales del carrito.
// Se usa tanto para cotizar el carrito como para crear el pedido, así el total
// mostrado y el cobrado son siempre el mismo cálculo (y siempre en el servidor).
import { db } from '../db/index.js';
import { HttpError } from '../utils/errors.js';
import { money } from '../utils/helpers.js';
import { getSettings } from './settings.js';

/** Promociones vigentes en este momento */
export const activePromotions = (q = db) =>
  q.query(`SELECT * FROM promotions WHERE active AND NOW() BETWEEN starts_at AND ends_at`).then((r) => r.rows);

/**
 * Precio final de un producto para un tipo de cliente.
 * 1) Precio por tipo de cliente: precio propio del producto o % general de configuración.
 * 2) Precio de oferta: mejor promoción vigente del producto o su categoría.
 * Se cobra el menor de los dos (los descuentos no se acumulan).
 */
export function priceFor(product, customerType = 'normal', promos = [], discounts = {}) {
  const list = Number(product.price);
  let typePrice = list;
  if (customerType === 'taller') {
    typePrice = product.price_workshop ?? list * (1 - (discounts.taller || 0) / 100);
  } else if (customerType === 'mayorista') {
    typePrice = product.price_wholesale ?? list * (1 - (discounts.mayorista || 0) / 100);
  }
  const promo = promos
    .filter((p) => (p.scope === 'product' && p.product_id === product.id) ||
                   (p.scope === 'category' && p.category_id === product.category_id))
    .sort((a, b) => b.percent - a.percent)[0];
  const promoPrice = promo ? list * (1 - promo.percent / 100) : Infinity;

  const price = money(Math.min(typePrice, promoPrice));
  return {
    price,
    list_price: money(list),
    promo: promo && promoPrice <= typePrice ? { name: promo.name, percent: promo.percent, ends_at: promo.ends_at } : null,
    customer_price: customerType !== 'normal' && typePrice < list && typePrice <= promoPrice,
  };
}

/** Agrega precio final a una lista de productos (para listados) */
export async function withPrices(products, user) {
  const [promos, settings] = await Promise.all([activePromotions(), getSettings()]);
  const type = user?.customer_type || 'normal';
  return products.map((p) => {
    const { cost_price, price_workshop, price_wholesale, ...pub } = p; // nunca exponer costo
    const isStaff = user && user.role !== 'cliente';
    return {
      ...pub,
      ...(isStaff ? { cost_price, price_workshop, price_wholesale } : {}),
      pricing: priceFor(p, type, promos, settings.customer_discounts),
    };
  });
}

/** Valida un cupón contra el subtotal. Devuelve { coupon, discount } o lanza error */
export async function applyCoupon(codeStr, subtotal, q = db) {
  if (!codeStr) return { coupon: null, discount: 0 };
  const c = (await q.query('SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)', [codeStr.trim()])).rows[0];
  const now = new Date();
  if (!c || !c.active) throw new HttpError(400, 'El cupón no existe o no está activo');
  if (c.starts_at && new Date(c.starts_at) > now) throw new HttpError(400, 'El cupón aún no está vigente');
  if (c.ends_at && new Date(c.ends_at) < now) throw new HttpError(400, 'El cupón está vencido');
  if (c.max_uses && c.used_count >= c.max_uses) throw new HttpError(400, 'El cupón ya alcanzó su límite de usos');
  if (subtotal < Number(c.min_order)) {
    throw new HttpError(400, `El cupón requiere una compra mínima de Bs. ${Number(c.min_order).toLocaleString('es-VE')}`);
  }
  const discount = c.type === 'percent' ? subtotal * (c.value / 100) : Math.min(c.value, subtotal);
  return { coupon: c, discount: money(discount) };
}

/**
 * Cotiza un carrito completo.
 * @param input { items:[{product_id, quantity}], coupon, delivery_type, shipping_zone_id }
 * @param q     ejecutor de consultas (db o transacción). En transacción bloquea las filas.
 */
export async function quoteCart(input, user, q = db, { lock = false } = {}) {
  const items = (input.items || []).filter((i) => i && Number(i.quantity) > 0);
  if (!items.length) throw new HttpError(400, 'El carrito está vacío');

  const ids = items.map((i) => Number(i.product_id));
  const products = (await q.query(
    `SELECT * FROM products WHERE id = ANY($1::int[]) AND active ${lock ? 'FOR UPDATE' : ''}`, [ids]
  )).rows;
  const [promos, settings] = await Promise.all([activePromotions(q), getSettings(q)]);
  const type = user?.customer_type || 'normal';

  const lines = [];
  const problems = [];
  for (const it of items) {
    const p = products.find((x) => x.id === Number(it.product_id));
    const qty = Math.floor(Number(it.quantity));
    if (!p) { problems.push({ product_id: it.product_id, error: 'Producto no disponible' }); continue; }
    if (p.stock < qty) {
      problems.push({ product_id: p.id, error: `Solo quedan ${p.stock} unidades de "${p.name}"`, stock: p.stock });
    }
    const pr = priceFor(p, type, promos, settings.customer_discounts);
    lines.push({
      product_id: p.id, name: p.name, sku: p.sku, slug: p.slug, images: p.images, stock: p.stock,
      quantity: qty, unit_price: pr.price, list_price: pr.list_price, unit_cost: Number(p.cost_price),
      total: money(pr.price * qty), promo: pr.promo,
    });
  }

  const subtotal = money(lines.reduce((s, l) => s + l.total, 0));

  // Cupón: si es inválido en la cotización se informa sin romper el resto
  let coupon = null, discount = 0, couponError = null;
  try {
    ({ coupon, discount } = await applyCoupon(input.coupon, subtotal, q));
  } catch (e) {
    if (lock) throw e;
    couponError = e.message;
  }

  // Envío
  let shipping = 0, zone = null;
  const delivery = input.delivery_type === 'retiro' ? 'retiro' : 'envio';
  if (delivery === 'envio' && input.shipping_zone_id) {
    zone = (await q.query('SELECT * FROM shipping_zones WHERE id = $1 AND active', [input.shipping_zone_id])).rows[0];
    if (!zone) throw new HttpError(400, 'Zona de envío no válida');
    shipping = zone.free_from && subtotal - discount >= Number(zone.free_from) ? 0 : Number(zone.cost);
  }

  const taxRate = Number(settings.tax.rate) || 0;
  const tax = money((subtotal - discount) * (taxRate / 100));
  const total = money(subtotal - discount + tax + shipping);

  return {
    lines, problems, subtotal, discount, coupon: coupon?.code || null, couponError,
    delivery_type: delivery, zone, shipping_cost: money(shipping),
    tax_name: settings.tax.name, tax_rate: taxRate, tax, total, customer_type: type,
  };
}
