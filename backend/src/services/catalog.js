// Búsqueda de productos: texto libre, número OEM/código, categoría, compatibilidad
// con vehículo, filtros de precio/marca/original/disponibilidad y ordenamiento.
import { db } from '../db/index.js';
import { bool, paginate } from '../utils/helpers.js';

const SORTS = {
  relevance: 'p.featured DESC, p.sold_count DESC, p.name',
  best_sellers: 'p.sold_count DESC, p.name',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  newest: 'p.created_at DESC',
  name: 'p.name ASC',
};

export const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
         b.name AS brand_name,
         COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.product_id = p.id), 0) AS rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN part_brands b ON b.id = p.brand_id`;

/** "Bujías" → "bujias" (minúsculas, sin acentos) */
const unaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Construye el WHERE a partir de los filtros de la URL.
 * @param includeInactive  el panel admin puede ver productos desactivados
 * @param skip             filtro a omitir (para calcular facetas)
 */
function buildWhere(f, { includeInactive = false, skip } = {}) {
  const where = [];
  const params = [];
  // Agrega un valor a los parámetros y devuelve su placeholder ($1, $2, ...)
  const p = (v) => { params.push(v); return `$${params.length}`; };

  if (!includeInactive) where.push('p.active');
  if (f.q) {
    // Busca en nombre, descripción, SKU, OEM y código del fabricante.
    // Para códigos se ignoran guiones/espacios: "04465-02220" = "0446502220"
    // El texto se compara sin acentos: "bujias" encuentra "bujías"
    const text = `%${unaccent(String(f.q).trim())}%`;
    const compact = `%${String(f.q).replace(/[\s.-]/g, '')}%`;
    const t = p(text), c = p(compact);
    const plain = (col) => `TRANSLATE(LOWER(COALESCE(${col}, '')), 'áéíóúüñ', 'aeiouun')`;
    where.push(`(${plain('p.name')} LIKE ${t} OR ${plain('p.description')} LIKE ${t} OR ${plain('b.name')} LIKE ${t}
      OR REPLACE(REPLACE(p.sku,'-',''),' ','') ILIKE ${c}
      OR REPLACE(REPLACE(COALESCE(p.oem_number,''),'-',''),' ','') ILIKE ${c}
      OR REPLACE(REPLACE(COALESCE(p.manufacturer_code,''),'-',''),' ','') ILIKE ${c})`);
  }
  if (f.category) where.push(`c.slug = ${p(f.category)}`);
  if (f.brand && skip !== 'brand') {
    const ids = String(f.brand).split(',').map(Number).filter(Boolean);
    if (ids.length) where.push(`p.brand_id = ANY(${p(ids)}::int[])`);
  }
  if (f.original === 'original') where.push('p.is_original');
  if (f.original === 'generico') where.push('NOT p.is_original');
  if (bool(f.in_stock)) where.push('p.stock > 0');
  if (f.min_price) where.push(`p.price >= ${p(Number(f.min_price))}`);
  if (f.max_price) where.push(`p.price <= ${p(Number(f.max_price))}`);
  if (f.vehicle_id) {
    where.push(`EXISTS (SELECT 1 FROM product_vehicles pv WHERE pv.product_id = p.id AND pv.vehicle_id = ${p(Number(f.vehicle_id))})`);
  }
  if (f.make_id && !f.vehicle_id) {
    where.push(`EXISTS (SELECT 1 FROM product_vehicles pv JOIN vehicles v ON v.id = pv.vehicle_id
      JOIN vehicle_models md ON md.id = v.model_id WHERE pv.product_id = p.id AND md.make_id = ${p(Number(f.make_id))})`);
  }
  if (bool(f.featured)) where.push('p.featured');
  if (bool(f.low_stock)) where.push('p.stock <= p.min_stock');
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

export async function searchProducts(filters, opts = {}) {
  const { limit, page, offset } = paginate(filters, opts.defLimit || 24);
  const { sql, params } = buildWhere(filters, opts);
  const order = SORTS[filters.sort] || SORTS.relevance;

  const rows = await db.many(
    `${PRODUCT_SELECT} ${sql} ORDER BY ${order}, p.id LIMIT ${limit} OFFSET ${offset}`, params
  );
  const { count } = await db.one(
    `SELECT COUNT(*) AS count FROM products p
     LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN part_brands b ON b.id = p.brand_id ${sql}`,
    params
  );
  // Facetas de marca: cuántos productos hay por marca con los demás filtros aplicados
  const facet = buildWhere(filters, { ...opts, skip: 'brand' });
  const brands = await db.many(
    `SELECT b.id, b.name, COUNT(*) AS count FROM products p
     LEFT JOIN categories c ON c.id = p.category_id JOIN part_brands b ON b.id = p.brand_id
     ${facet.sql} GROUP BY b.id, b.name ORDER BY b.name`,
    facet.params
  );
  return { items: rows, total: count, page, pages: Math.max(Math.ceil(count / limit), 1), limit, facets: { brands } };
}

/** Lista de vehículos compatibles de un producto, lista para mostrar en tabla */
export const productCompatibility = (productId) =>
  db.many(
    `SELECT v.id AS vehicle_id, mk.name AS make, md.name AS model, v.year, v.engine, pv.note
     FROM product_vehicles pv
     JOIN vehicles v ON v.id = pv.vehicle_id
     JOIN vehicle_models md ON md.id = v.model_id
     JOIN vehicle_makes mk ON mk.id = md.make_id
     WHERE pv.product_id = $1
     ORDER BY mk.name, md.name, v.year, v.engine`,
    [productId]
  );
