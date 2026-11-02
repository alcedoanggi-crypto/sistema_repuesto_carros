// Rutas públicas del catálogo: categorías, marcas, buscador por vehículo,
// listado/búsqueda de productos, ficha de producto, reseñas e información de la tienda.
import { Router } from 'express';
import { db } from '../db/index.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notFound } from '../utils/errors.js';
import { searchProducts, productCompatibility, PRODUCT_SELECT } from '../services/catalog.js';
import { withPrices, activePromotions } from '../services/pricing.js';
import { getSettings } from '../services/settings.js';

const r = Router();
r.use(optionalAuth); // los precios dependen del tipo de cliente si hay sesión

// ---------- Información de la tienda (footer, checkout, WhatsApp) ----------
r.get('/store', async (_req, res) => {
  const s = await getSettings();
  const [payments, zones, promos] = await Promise.all([
    db.many('SELECT code, name, instructions, requires_reference FROM payment_methods WHERE active ORDER BY sort_order, id'),
    db.many('SELECT id, name, states, cost, free_from, est_days FROM shipping_zones WHERE active ORDER BY cost, id'),
    activePromotions(),
  ]);
  const banners = await db.many(
    `SELECT pr.id, pr.name, pr.percent, pr.ends_at, pr.scope, c.slug AS category_slug, c.name AS category_name, p.slug AS product_slug
     FROM promotions pr LEFT JOIN categories c ON c.id = pr.category_id LEFT JOIN products p ON p.id = pr.product_id
     WHERE pr.id = ANY($1::int[]) AND pr.banner ORDER BY pr.percent DESC`,
    [promos.map((p) => p.id)]
  );
  res.json({ store: s.store, tax: s.tax, pickup: s.pickup, payment_methods: payments, shipping_zones: zones, banners });
});

// ---------- Categorías y marcas ----------
r.get('/categories', async (_req, res) => {
  res.json(await db.many(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active) AS product_count
     FROM categories c ORDER BY c.sort_order, c.name`
  ));
});

r.get('/brands', async (_req, res) => {
  res.json(await db.many('SELECT * FROM part_brands ORDER BY name'));
});

// ---------- Buscador por compatibilidad: Marca → Modelo → Año → Motor ----------
r.get('/vehicles/makes', async (_req, res) => {
  res.json(await db.many(
    `SELECT mk.*, (SELECT COUNT(*) FROM vehicle_models m WHERE m.make_id = mk.id) AS model_count
     FROM vehicle_makes mk ORDER BY mk.name`
  ));
});

r.get('/vehicles/models', async (req, res) => {
  res.json(await db.many('SELECT id, name FROM vehicle_models WHERE make_id = $1 ORDER BY name', [Number(req.query.make_id)]));
});

r.get('/vehicles/years', async (req, res) => {
  const rows = await db.many('SELECT DISTINCT year FROM vehicles WHERE model_id = $1 ORDER BY year DESC', [Number(req.query.model_id)]);
  res.json(rows.map((x) => x.year));
});

r.get('/vehicles/engines', async (req, res) => {
  res.json(await db.many(
    'SELECT id, engine FROM vehicles WHERE model_id = $1 AND year = $2 ORDER BY engine',
    [Number(req.query.model_id), Number(req.query.year)]
  ));
});

/** Descripción completa de un vehículo (para mostrar "Toyota Corolla 2012 1.8L") */
r.get('/vehicles/:id', async (req, res) => {
  const v = await db.one(
    `SELECT v.id, v.year, v.engine, md.id AS model_id, md.name AS model, mk.id AS make_id, mk.name AS make
     FROM vehicles v JOIN vehicle_models md ON md.id = v.model_id JOIN vehicle_makes mk ON mk.id = md.make_id
     WHERE v.id = $1`, [Number(req.params.id)]
  );
  if (!v) throw notFound('Vehículo');
  res.json(v);
});

// ---------- Productos ----------
r.get('/products', async (req, res) => {
  const result = await searchProducts(req.query);
  result.items = await withPrices(result.items, req.user);
  res.json(result);
});

/** Autocompletado rápido del buscador del header */
r.get('/products/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const { items } = await searchProducts({ q, limit: 6 });
  res.json(items.map((p) => ({ id: p.id, name: p.name, slug: p.slug, sku: p.sku, oem_number: p.oem_number, category_icon: p.category_icon })));
});

r.get('/products/:slug', async (req, res) => {
  const row = await db.one(`${PRODUCT_SELECT} WHERE p.slug = $1 AND p.active`, [req.params.slug]);
  if (!row) throw notFound('Producto');
  const [product] = await withPrices([row], req.user);

  const [compatibility, reviews, relatedRows] = await Promise.all([
    productCompatibility(row.id),
    db.many(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name,
              EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                      WHERE oi.product_id = r.product_id AND o.user_id = r.user_id AND o.status = 'entregado') AS verified
       FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = $1 ORDER BY r.created_at DESC`, [row.id]
    ),
    // Relacionados: misma categoría o que comparten vehículos compatibles
    db.many(
      `${PRODUCT_SELECT}
       WHERE p.active AND p.id <> $1 AND (p.category_id = $2 OR EXISTS (
         SELECT 1 FROM product_vehicles a JOIN product_vehicles b ON a.vehicle_id = b.vehicle_id
         WHERE a.product_id = p.id AND b.product_id = $1))
       ORDER BY (p.category_id = $2) DESC, p.sold_count DESC LIMIT 8`, [row.id, row.category_id]
    ),
  ]);

  // ¿Le sirve al vehículo seleccionado por el cliente?
  let fits = null;
  if (req.query.vehicle_id) fits = compatibility.some((c) => c.vehicle_id === Number(req.query.vehicle_id));

  // Nombre primero para mostrar el nombre del cliente abreviado: "María G."
  const shortName = (n) => { const [a, b] = n.split(' '); return b ? `${a} ${b[0]}.` : a; };
  res.json({
    ...product,
    compatibility,
    fits,
    reviews: reviews.map((x) => ({ ...x, user_name: shortName(x.user_name) })),
    related: await withPrices(relatedRows, req.user),
  });
});

r.post('/products/:id/reviews', requireAuth,
  validate({ rating: 'required|int|min:1|max:5', comment: 'maxlen:1000' }, { rating: 'Calificación', comment: 'Comentario' }),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!(await db.one('SELECT 1 FROM products WHERE id = $1', [id]))) throw notFound('Producto');
    const review = await db.one(
      `INSERT INTO reviews (product_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = NOW()
       RETURNING *`,
      [id, req.user.id, Number(req.body.rating), req.body.comment?.trim() || null]
    );
    res.status(201).json(review);
  });

export default r;
