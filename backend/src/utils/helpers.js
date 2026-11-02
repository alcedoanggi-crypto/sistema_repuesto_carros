// Utilidades compartidas

/** "Pastillas de Freno Bosch" → "pastillas-de-freno-bosch" */
export function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Redondeo monetario a 2 decimales */
export const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Genera códigos legibles: code('MAC', 12) → MAC-000012 */
export const code = (prefix, id) => `${prefix}-${String(id).padStart(6, '0')}`;

/** Formato de moneda venezolana: 1234.5 → "Bs. 1.234,50" */
export const bs = (n) =>
  'Bs. ' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Lee paginación de la query string con límites seguros */
export function paginate(query, defLimit = 24, maxLimit = 100) {
  const limit = Math.min(Math.max(parseInt(query.limit) || defLimit, 1), maxLimit);
  const page = Math.max(parseInt(query.page) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
}

/** Convierte "true"/"1"/true a booleano */
export const bool = (v) => v === true || v === 'true' || v === '1' || v === 1;
