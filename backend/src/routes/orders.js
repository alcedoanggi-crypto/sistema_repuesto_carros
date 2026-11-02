// Carrito (cotización) y checkout de la tienda
import { Router } from 'express';
import { optionalAuth, requireAuth, canAccess } from '../middleware/auth.js';
import { check } from '../middleware/validate.js';
import { notFound } from '../utils/errors.js';
import { quoteCart } from '../services/pricing.js';
import { createOrder, orderDetail } from '../services/orders.js';
import { invoicePdf } from '../services/invoice.js';

const r = Router();

/** Cotiza el carrito: precios vigentes, stock, cupón, envío e IVA. No guarda nada. */
r.post('/cart/quote', optionalAuth, async (req, res) => {
  res.json(await quoteCart(req.body, req.user));
});

/** Confirma el pedido */
r.post('/orders', requireAuth, async (req, res) => {
  const b = req.body;
  // Validación de datos del comprador y de envío con mensajes por campo
  check(b.customer || {}, {
    name: 'required|minlen:3', email: 'required|email', phone: 'required|phone', doc_id: 'required|docid',
  }, { name: 'Nombre', email: 'Correo', phone: 'Teléfono', doc_id: 'Cédula/RIF' });
  if (b.delivery_type !== 'retiro') {
    check(b.address || {}, { recipient: 'required', state: 'required', city: 'required', line: 'required|minlen:5' },
      { recipient: 'Quien recibe', state: 'Estado', city: 'Ciudad', line: 'Dirección' });
  }
  const order = await createOrder(b, req.user);
  res.status(201).json(order);
});

/** Comprobante PDF: lo puede descargar el dueño del pedido o el personal con acceso a pedidos */
r.get('/orders/:code/invoice', requireAuth, async (req, res) => {
  const o = await orderDetail({ code: req.params.code });
  if (!o || (o.user_id !== req.user.id && !canAccess(req.user, 'pedidos'))) throw notFound('Pedido');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${o.code}.pdf"`);
  (await invoicePdf(o)).pipe(res);
});

export default r;
