// Panel → Configuración: datos de la tienda, impuestos, descuentos por tipo de cliente,
// retiro en tienda, métodos de pago, zonas de envío, categorías y marcas de repuestos.
import { Router } from 'express';
import { getSettings, saveSetting, DEFAULT_SETTINGS } from '../../services/settings.js';
import { check } from '../../middleware/validate.js';
import { HttpError } from '../../utils/errors.js';
import { crud } from '../../utils/crud.js';
import { slugify } from '../../utils/helpers.js';

const r = Router();

r.get('/', async (_req, res) => res.json(await getSettings()));

/** PUT /settings/store | /tax | /customer_discounts | /pickup */
r.put('/:key', async (req, res, next) => {
  const key = req.params.key;
  if (!(key in DEFAULT_SETTINGS)) return next();
  const b = req.body || {};
  if (key === 'store') {
    check(b, { name: 'required', rif: 'required|docid', email: 'required|email', phone: 'required|phone', whatsapp: 'required' },
      { name: 'Nombre', rif: 'RIF', email: 'Correo', phone: 'Teléfono', whatsapp: 'WhatsApp' });
    if (!/^58\d{10}$/.test(String(b.whatsapp))) {
      throw new HttpError(422, 'Revisa los datos del formulario', { whatsapp: 'Formato internacional sin + ni espacios: 584141234567' });
    }
  }
  if (key === 'tax') check(b, { name: 'required', rate: 'required|number|min:0|max:50' }, { name: 'Nombre del impuesto', rate: 'Tasa' });
  if (key === 'customer_discounts') {
    check(b, { taller: 'required|number|min:0|max:60', mayorista: 'required|number|min:0|max:60' }, { taller: 'Taller', mayorista: 'Mayorista' });
  }
  await saveSetting(key, { ...DEFAULT_SETTINGS[key], ...b });
  res.json(await getSettings());
});

r.use('/payment-methods', crud({
  table: 'payment_methods',
  fields: ['code', 'name', 'instructions', 'requires_reference', 'active', 'sort_order'],
  rules: { code: 'required|maxlen:30', name: 'required|maxlen:80' },
  labels: { code: 'Código', name: 'Nombre' },
  orderBy: 'sort_order, id',
  prepare: (b) => ({ ...b, code: slugify(b.code).replace(/-/g, '_'), requires_reference: !!b.requires_reference, active: b.active ?? true, sort_order: b.sort_order || 0 }),
}));

r.use('/shipping-zones', crud({
  table: 'shipping_zones',
  fields: ['name', 'states', 'cost', 'free_from', 'est_days', 'active'],
  rules: { name: 'required|maxlen:80', cost: 'required|number|min:0', free_from: 'number|min:0', est_days: 'required' },
  labels: { name: 'Nombre', cost: 'Costo', free_from: 'Gratis desde', est_days: 'Tiempo estimado' },
  orderBy: 'cost, id',
  prepare: (b) => ({
    ...b,
    states: Array.isArray(b.states) ? b.states : String(b.states || '').split(',').map((s) => s.trim()).filter(Boolean),
    active: b.active ?? true,
  }),
}));

r.use('/categories', crud({
  table: 'categories',
  fields: ['name', 'slug', 'icon', 'description', 'sort_order'],
  rules: { name: 'required|maxlen:80' },
  labels: { name: 'Nombre' },
  orderBy: 'sort_order, name',
  prepare: (b) => ({ ...b, slug: slugify(b.slug || b.name), icon: b.icon || 'box', sort_order: b.sort_order || 0 }),
}));

r.use('/brands', crud({
  table: 'part_brands',
  fields: ['name', 'slug'],
  rules: { name: 'required|maxlen:80' },
  labels: { name: 'Nombre' },
  orderBy: 'name',
  prepare: (b) => ({ ...b, slug: slugify(b.name) }),
}));

export default r;
