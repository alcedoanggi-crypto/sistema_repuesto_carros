// Panel → Promociones: cupones, descuentos por categoría y ofertas por tiempo limitado
import { Router } from 'express';
import { crud } from '../../utils/crud.js';
import { HttpError } from '../../utils/errors.js';

const r = Router();

r.use('/coupons', crud({
  table: 'coupons',
  fields: ['code', 'type', 'value', 'min_order', 'max_uses', 'starts_at', 'ends_at', 'active'],
  rules: { code: 'required|minlen:3|maxlen:30', type: 'required|in:percent,fixed', value: 'required|number|min:0.01',
           min_order: 'number|min:0', max_uses: 'int|min:1' },
  labels: { code: 'Código', type: 'Tipo', value: 'Valor', min_order: 'Compra mínima', max_uses: 'Usos máximos' },
  orderBy: 'active DESC, ends_at DESC NULLS LAST, code',
  prepare: (b) => {
    if (b.type === 'percent' && Number(b.value) >= 100) throw new HttpError(422, 'Revisa los datos del formulario', { value: 'El porcentaje debe ser menor a 100' });
    return { ...b, code: String(b.code).trim().toUpperCase().replace(/\s+/g, ''), min_order: b.min_order || 0, active: b.active ?? true };
  },
}));

r.use('/promotions', crud({
  table: 'promotions',
  fields: ['name', 'scope', 'category_id', 'product_id', 'percent', 'starts_at', 'ends_at', 'banner', 'active'],
  rules: { name: 'required|minlen:3|maxlen:120', scope: 'required|in:category,product', percent: 'required|number|min:1|max:90',
           starts_at: 'required', ends_at: 'required' },
  labels: { name: 'Nombre', scope: 'Aplica a', percent: 'Descuento %', starts_at: 'Inicio', ends_at: 'Fin' },
  select: `SELECT pr.*, c.name AS category_name, p.name AS product_name,
             (pr.active AND NOW() BETWEEN pr.starts_at AND pr.ends_at) AS running
           FROM promotions pr LEFT JOIN categories c ON c.id = pr.category_id LEFT JOIN products p ON p.id = pr.product_id
           ORDER BY pr.ends_at DESC`,
  prepare: (b) => {
    if (b.scope === 'category' && !b.category_id) throw new HttpError(422, 'Revisa los datos del formulario', { category_id: 'Selecciona la categoría' });
    if (b.scope === 'product' && !b.product_id) throw new HttpError(422, 'Revisa los datos del formulario', { product_id: 'Selecciona el producto' });
    if (new Date(b.ends_at) <= new Date(b.starts_at)) throw new HttpError(422, 'Revisa los datos del formulario', { ends_at: 'Debe ser posterior al inicio' });
    return {
      ...b,
      category_id: b.scope === 'category' ? b.category_id : null,
      product_id: b.scope === 'product' ? b.product_id : null,
      banner: !!b.banner, active: b.active ?? true,
    };
  },
}));

export default r;
