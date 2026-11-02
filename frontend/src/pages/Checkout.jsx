// Checkout: datos del comprador, entrega (envío o retiro), pago y confirmación
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { bs, VE_STATES } from '../lib/format.js';
import { useQuote, Totals } from './Cart.jsx';
import Icon from '../components/Icon.jsx';
import Seo from '../components/Seo.jsx';
import { Field, FormError, Input, Loading, Select, Textarea } from '../components/ui.jsx';

const Step = ({ n, title, children }) => (
  <section className="card p-5">
    <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
      <span className="grid size-7 place-items-center rounded-full bg-brand-600 font-sans text-sm text-white">{n}</span>{title}
    </h2>
    {children}
  </section>
);

export default function Checkout() {
  const { user, authReady, cart, clearCart, storeInfo, toast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', doc_id: '' });
  const [delivery, setDelivery] = useState('envio');
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState('new');
  const [address, setAddress] = useState({ recipient: '', phone: '', state: '', city: '', line: '', reference: '' });
  const [zoneId, setZoneId] = useState('');
  const [payment, setPayment] = useState('');
  const [reference, setReference] = useState('');
  const [coupon] = useState(location.state?.coupon || '');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  const zones = storeInfo?.shipping_zones || [];
  const methods = storeInfo?.payment_methods || [];
  const method = methods.find((m) => m.code === payment);

  // Datos guardados del cliente
  useEffect(() => {
    if (!user) return;
    setCustomer({ name: user.name || '', email: user.email || '', phone: user.phone || '', doc_id: user.doc_id || '' });
    api.get('/account/addresses').then((list) => {
      setAddresses(list);
      const def = list.find((a) => a.is_default) || list[0];
      if (def) { setAddressId(String(def.id)); setAddress(def); }
    });
  }, [user]);

  // La zona de envío se elige automáticamente según el estado de la dirección
  useEffect(() => {
    const z = zones.find((x) => x.states.includes(address.state));
    if (z) setZoneId(String(z.id));
  }, [address.state, zones]);

  const { quote, error: quoteError } = useQuote({
    coupon, delivery_type: delivery, shipping_zone_id: delivery === 'envio' ? zoneId || undefined : undefined,
  });

  if (!authReady) return <Loading />;
  if (!user) return <Navigate to="/ingresar?next=/checkout" replace />;
  if (!cart.length) return <Navigate to="/carrito" replace />;

  const pickAddress = (id) => {
    setAddressId(id);
    if (id === 'new') setAddress({ recipient: customer.name, phone: customer.phone, state: '', city: '', line: '', reference: '' });
    else setAddress(addresses.find((a) => String(a.id) === id));
  };

  const submit = async (e) => {
    e.preventDefault();
    setErrors({}); setFormError('');
    // Validación rápida en el navegador (el servidor valida de nuevo)
    const errs = {};
    if (!payment) errs.payment_method = 'Selecciona un método de pago';
    if (method?.requires_reference && !reference.trim()) errs.payment_reference = 'Indica la referencia del pago';
    if (delivery === 'envio' && !zoneId) errs.zone = 'Selecciona la zona de envío';
    if (Object.keys(errs).length) { setErrors(errs); setFormError('Revisa los campos marcados'); return; }

    setSending(true);
    try {
      const body = {
        items: cart, coupon, delivery_type: delivery, shipping_zone_id: delivery === 'envio' ? Number(zoneId) : null,
        address: delivery === 'envio' ? address : null, payment_method: payment, payment_reference: reference, notes, customer,
      };
      const order = await api.post('/orders', body);
      // Guarda la dirección nueva para próximas compras
      if (delivery === 'envio' && addressId === 'new') api.post('/account/addresses', { ...address, label: 'Envío' }).catch(() => {});
      clearCart();
      toast(`¡Pedido ${order.code} recibido!`);
      navigate(`/cuenta/pedidos/${order.code}?nuevo=1`, { replace: true });
    } catch (err) {
      setErrors(err.details || {});
      setFormError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally { setSending(false); }
  };

  const c = (k) => ({ value: customer[k] || '', error: errors[k], onChange: (e) => setCustomer({ ...customer, [k]: e.target.value }) });
  const a = (k) => ({ value: address[k] || '', error: errors[k], disabled: addressId !== 'new', onChange: (e) => setAddress({ ...address, [k]: e.target.value }) });

  return (
    <form onSubmit={submit} className="mx-auto max-w-7xl px-4 py-6" noValidate>
      <Seo title="Finalizar compra" noindex />
      <h1 className="mb-6 text-4xl font-extrabold uppercase">Finalizar compra</h1>
      <FormError error={formError || quoteError} />
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Step n="1" title="Tus datos">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre o razón social" error={errors.name}><Input autoComplete="name" required {...c('name')} /></Field>
              <Field label="Cédula o RIF" error={errors.doc_id} hint="Ej: V-12345678 o J-40123456-7"><Input required placeholder="V-12345678" {...c('doc_id')} /></Field>
              <Field label="Teléfono" error={errors.phone}><Input type="tel" autoComplete="tel" required placeholder="0414-1234567" {...c('phone')} /></Field>
              <Field label="Correo" error={errors.email}><Input type="email" autoComplete="email" required {...c('email')} /></Field>
            </div>
          </Step>

          <Step n="2" title="Entrega">
            <div className="grid gap-3 sm:grid-cols-2">
              {[['envio', 'truck', 'Envío a domicilio', 'Delivery en Gran Caracas o encomienda al interior'],
                ['retiro', 'store', 'Retiro en tienda', storeInfo?.pickup?.address || 'Tienda MACAI']].map(([v, icon, t, d]) => (
                <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-4 ${delivery === v ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'border-ink-200 dark:border-ink-700'}`}>
                  <input type="radio" name="delivery" className="sr-only" checked={delivery === v} onChange={() => setDelivery(v)} />
                  <Icon name={icon} className="size-6 shrink-0 text-brand-600" />
                  <span><b className="block text-sm">{t}</b><span className="text-xs text-ink-500">{d}</span></span>
                </label>
              ))}
            </div>

            {delivery === 'envio' && (
              <div className="mt-4 space-y-3">
                {addresses.length > 0 && (
                  <Field label="Dirección de envío">
                    <Select value={addressId} onChange={(e) => pickAddress(e.target.value)}>
                      {addresses.map((x) => <option key={x.id} value={x.id}>{x.label}: {x.line}, {x.city}</option>)}
                      <option value="new">+ Nueva dirección</option>
                    </Select>
                  </Field>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Quien recibe" error={errors.recipient}><Input {...a('recipient')} /></Field>
                  <Field label="Teléfono de contacto" error={errors.phone}><Input type="tel" {...a('phone')} /></Field>
                  <Field label="Estado" error={errors.state}>
                    <Select {...a('state')}><option value="">Selecciona</option>{VE_STATES.map((s) => <option key={s}>{s}</option>)}</Select>
                  </Field>
                  <Field label="Ciudad / municipio" error={errors.city}><Input {...a('city')} /></Field>
                  <Field label="Dirección" error={errors.line} className="sm:col-span-2"><Input placeholder="Urbanización, calle, casa o edificio, apto." {...a('line')} /></Field>
                  <Field label="Punto de referencia (opcional)" className="sm:col-span-2"><Input {...a('reference')} /></Field>
                </div>
                <Field label="Zona de envío" error={errors.zone} hint="Se elige automáticamente según el estado">
                  <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                    <option value="">Selecciona</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name} — {bs(z.cost)} · {z.est_days}{z.free_from ? ` · gratis desde ${bs(z.free_from)}` : ''}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </Step>

          <Step n="3" title="Pago">
            {errors.payment_method && <p className="mb-2 text-xs font-medium text-red-600">{errors.payment_method}</p>}
            <div className="space-y-2">
              {methods.map((m) => (
                <label key={m.code} className={`block cursor-pointer rounded-xl border-2 p-4 ${payment === m.code ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'border-ink-200 dark:border-ink-700'}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="payment" className="accent-brand-600" checked={payment === m.code} onChange={() => setPayment(m.code)} />
                    <b className="text-sm">{m.name}</b>
                  </span>
                  {payment === m.code && m.instructions && <p className="mt-2 ml-7 text-sm text-ink-600 dark:text-ink-300">{m.instructions}</p>}
                </label>
              ))}
            </div>
            {method?.requires_reference && (
              <Field label="Número de referencia del pago" error={errors.payment_reference} className="mt-3" hint="Verificamos el pago y te confirmamos por correo y WhatsApp">
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej: 004512" />
              </Field>
            )}
            <Field label="Notas para el pedido (opcional)" className="mt-3">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Horario de entrega, datos del vehículo, etc." />
            </Field>
          </Step>
        </div>

        <aside className="card h-fit p-5 lg:sticky lg:top-40">
          <h2 className="mb-3 text-2xl font-bold">Tu pedido</h2>
          {!quote ? <Loading /> : (
            <>
              <ul className="mb-3 space-y-2 border-b border-ink-200 pb-3 text-sm dark:border-ink-700">
                {quote.lines.map((l) => (
                  <li key={l.product_id} className="flex justify-between gap-3"><span className="line-clamp-2">{l.quantity} × {l.name}</span><span className="shrink-0">{bs(l.total)}</span></li>
                ))}
              </ul>
              <Totals quote={quote} showShipping />
            </>
          )}
          <button className="btn-primary mt-4 w-full py-3" disabled={sending || !quote || quote.problems?.length > 0}>
            {sending ? 'Procesando...' : 'Confirmar pedido'}
          </button>
          <p className="mt-2 text-center text-xs text-ink-400">Al confirmar aceptas nuestra <Link to="/garantia" className="underline">política de garantía y devoluciones</Link>.</p>
        </aside>
      </div>
    </form>
  );
}
