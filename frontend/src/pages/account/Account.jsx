// Cuenta del cliente: pedidos y seguimiento, garaje, direcciones, lista de deseos y perfil
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useParams, useSearchParams } from 'react-router-dom';
import { api, download } from '../../lib/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { bs, date, dateTime, STATUS, VE_STATES, vehicleLabel, CUSTOMER_TYPES } from '../../lib/format.js';
import Icon from '../../components/Icon.jsx';
import Seo from '../../components/Seo.jsx';
import ProductCard from '../../components/ProductCard.jsx';
import VehicleSelector from '../../components/VehicleSelector.jsx';
import { Badge, Empty, Field, FormError, Input, Loading, Modal, Select } from '../../components/ui.jsx';

export function AccountLayout() {
  const { user, authReady, logout } = useApp();
  if (!authReady) return <Loading />;
  if (!user) return <Navigate to="/ingresar?next=/cuenta" replace />;
  const links = [['/cuenta', 'receipt', 'Mis pedidos', true], ['/cuenta/garaje', 'garage', 'Mi garaje'], ['/cuenta/deseos', 'heart', 'Lista de deseos'],
    ['/cuenta/direcciones', 'pin', 'Direcciones'], ['/cuenta/perfil', 'user', 'Mis datos']];
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Seo title="Mi cuenta" noindex />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-4xl font-extrabold uppercase">Hola, {user.name.split(' ')[0]}</h1>
          {user.customer_type !== 'normal' && <Badge color="blue">Cliente {CUSTOMER_TYPES[user.customer_type]} · precios especiales activos</Badge>}
        </div>
        <button onClick={logout} className="btn-ghost btn-sm"><Icon name="logout" className="size-4" /> Cerrar sesión</button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Mi cuenta">
          {links.map(([to, icon, l, end]) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
              <Icon name={icon} className="size-4" /> {l}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, color: 'gray' };
  return <Badge color={s.color}>{s.label}</Badge>;
}

export function MyOrders() {
  const [orders, setOrders] = useState(null);
  useEffect(() => { api.get('/account/orders').then(setOrders); }, []);
  if (!orders) return <Loading />;
  if (!orders.length) return <Empty icon="receipt" title="Aún no tienes pedidos" action={<Link to="/catalogo" className="btn-primary">Ir al catálogo</Link>} />;
  return (
    <div className="card divide-y divide-ink-100 dark:divide-ink-800">
      {orders.map((o) => (
        <Link key={o.id} to={`/cuenta/pedidos/${o.code}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-ink-50 dark:hover:bg-ink-850">
          <div className="min-w-32"><b className="font-display text-lg">{o.code}</b><div className="text-xs text-ink-400">{date(o.created_at)}</div></div>
          <StatusBadge status={o.status} />
          <span className="text-sm text-ink-500">{o.item_count} artículos · {o.delivery_type === 'retiro' ? 'Retiro en tienda' : 'Envío'}</span>
          <span className="ml-auto font-display text-xl font-bold">{bs(o.total)}</span>
          <Icon name="chevronRight" className="size-4 text-ink-400" />
        </Link>
      ))}
    </div>
  );
}

/** Línea de tiempo del pedido para seguimiento */
function Timeline({ order }) {
  const flow = ['pendiente', 'pagado', 'preparacion', ...(order.delivery_type === 'envio' ? ['enviado'] : []), 'entregado'];
  if (order.status === 'cancelado') return <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">Este pedido fue cancelado.</p>;
  const current = flow.indexOf(order.status);
  return (
    <ol className="grid grid-cols-2 gap-3 sm:flex sm:gap-0">
      {flow.map((s, i) => {
        const h = order.history.find((x) => x.status === s);
        const done = i <= current;
        return (
          <li key={s} className="relative flex-1">
            <div className="flex items-center">
              <span className={`z-10 grid size-8 place-items-center rounded-full ${done ? 'bg-brand-600 text-white' : 'bg-ink-200 text-ink-500 dark:bg-ink-800'}`}>
                {done ? <Icon name="check" className="size-4" /> : i + 1}
              </span>
              {i < flow.length - 1 && <span className={`hidden h-1 flex-1 sm:block ${i < current ? 'bg-brand-600' : 'bg-ink-200 dark:bg-ink-800'}`} />}
            </div>
            <p className={`mt-2 text-sm font-semibold ${done ? '' : 'text-ink-400'}`}>{STATUS[s].label}</p>
            {h && <p className="text-xs text-ink-400">{dateTime(h.created_at)}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function MyOrder() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const { toast } = useApp();
  const [o, setO] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get(`/account/orders/${code}`).then(setO).catch((e) => setErr(e.message)); }, [code]);
  if (err) return <Empty icon="receipt" title={err} />;
  if (!o) return <Loading />;

  const cancel = async () => {
    if (!window.confirm('¿Cancelar este pedido?')) return;
    try { setO(await api.post(`/account/orders/${code}/cancel`)); toast('Pedido cancelado'); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="space-y-5">
      {params.get('nuevo') && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-500/30 dark:bg-green-500/10">
          <h2 className="text-2xl font-bold text-green-800 dark:text-green-300">¡Gracias por tu compra!</h2>
          <p className="text-sm">Recibimos tu pedido <b>{o.code}</b>. {o.payment_reference ? 'Estamos verificando tu pago y te avisaremos al confirmarlo.' : o.payment_instructions}</p>
        </div>
      )}
      <div className="card p-5">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-3xl font-bold">{o.code}</h2>
          <StatusBadge status={o.status} />
          <span className="text-sm text-ink-400">{dateTime(o.created_at)}</span>
          <div className="ml-auto flex gap-2">
            {o.status === 'pendiente' && <button className="btn-ghost btn-sm text-red-600!" onClick={cancel}>Cancelar pedido</button>}
            <button className="btn-dark btn-sm" onClick={() => download(`/orders/${o.code}/invoice`, `${o.code}.pdf`, { open: true }).catch((e) => toast(e.message, 'error'))}>
              <Icon name="printer" className="size-4" /> Comprobante
            </button>
          </div>
        </div>
        <Timeline order={o} />
        {o.tracking_number && (
          <p className="mt-5 flex items-center gap-2 rounded-lg bg-ink-100 p-3 text-sm dark:bg-ink-850">
            <Icon name="truck" className="size-5 text-brand-600" /> Enviado por <b>{o.carrier}</b> · Guía N.º <b>{o.tracking_number}</b>
          </p>
        )}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="card p-5 text-sm">
          <h3 className="mb-2 text-xl font-bold">Entrega</h3>
          {o.delivery_type === 'retiro' ? <p>Retiro en tienda</p> : (
            <p>{o.shipping_address?.recipient} · {o.shipping_address?.phone}<br />{o.shipping_address?.line}<br />{o.shipping_address?.city}, {o.shipping_address?.state}<br />
              <span className="text-ink-500">{o.zone_name} · {o.est_days}</span></p>
          )}
        </div>
        <div className="card p-5 text-sm">
          <h3 className="mb-2 text-xl font-bold">Pago</h3>
          <p>{o.payment_method_name}{o.payment_reference && <> · Ref. <b>{o.payment_reference}</b></>}</p>
          {o.payment_instructions && o.status === 'pendiente' && <p className="mt-1 text-ink-500">{o.payment_instructions}</p>}
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Producto</th><th className="text-right">Cant.</th><th className="text-right">Precio</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id}>
                <td>{i.slug ? <Link to={`/producto/${i.slug}`} className="hover:underline">{i.name}</Link> : i.name}<div className="text-xs text-ink-400">SKU {i.sku}</div></td>
                <td className="text-right">{i.quantity}</td><td className="text-right">{bs(i.unit_price)}</td><td className="text-right font-semibold">{bs(i.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            {[['Subtotal', o.subtotal], ...(o.discount > 0 ? [[`Descuento ${o.coupon_code || ''}`, -o.discount]] : []), ['IVA', o.tax], ['Envío', o.shipping_cost]].map(([l, v]) => (
              <tr key={l}><td colSpan={3} className="px-3 py-1 text-right text-ink-500">{l}</td><td className="px-3 py-1 text-right">{bs(v)}</td></tr>
            ))}
            <tr><td colSpan={3} className="px-3 py-2 text-right font-bold">Total</td><td className="px-3 py-2 text-right font-display text-xl font-bold">{bs(o.total)}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function Garage() {
  const { setVehicle, vehicle, toast } = useApp();
  const [list, setList] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = () => api.get('/account/vehicles').then(setList);
  useEffect(() => { load(); }, []);
  const remove = async (id) => { await api.del(`/account/vehicles/${id}`); load(); toast('Vehículo eliminado'); };
  if (!list) return <Loading />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-3xl font-bold">Mi garaje</h2>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" className="size-4" /> Agregar vehículo</button>
      </div>
      {list.length === 0 ? <Empty icon="garage" title="No tienes vehículos guardados">Agrega tu carro para ver solo repuestos compatibles.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((v) => (
            <div key={v.id} className={`card p-4 ${vehicle?.id === v.vehicle_id ? 'border-brand-500!' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-ink-100 p-2 dark:bg-ink-800"><Icon name="car" /></span>
                <div className="flex-1">
                  <b className="font-display text-xl">{v.nickname || `${v.make} ${v.model}`}</b>
                  <p className="text-sm text-ink-500">{vehicleLabel(v)}</p>
                </div>
                <button onClick={() => remove(v.id)} className="p-1 text-ink-400 hover:text-red-600" aria-label="Eliminar"><Icon name="trash" className="size-4" /></button>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn-dark btn-sm" onClick={() => { setVehicle({ id: v.vehicle_id, make: v.make, model: v.model, year: v.year, engine: v.engine }); toast('Vehículo seleccionado'); }}>
                  {vehicle?.id === v.vehicle_id ? 'Seleccionado' : 'Usar este vehículo'}
                </button>
                <Link to={`/catalogo?vehicle_id=${v.vehicle_id}`} className="btn-ghost btn-sm">Ver repuestos</Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={adding} onClose={() => { setAdding(false); load(); }} title="Agregar vehículo" size="max-w-3xl">
        <VehicleSelector compact onDone={() => { setAdding(false); load(); }} />
      </Modal>
    </div>
  );
}

export function Wishlist() {
  const [list, setList] = useState(null);
  useEffect(() => { api.get('/account/wishlist').then(setList); }, []);
  if (!list) return <Loading />;
  return (
    <div>
      <h2 className="mb-4 text-3xl font-bold">Lista de deseos</h2>
      {list.length === 0 ? <Empty icon="heart" title="Tu lista está vacía">Toca el corazón en cualquier producto para guardarlo aquí.</Empty> : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">{list.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      )}
    </div>
  );
}

const EMPTY_ADDRESS = { label: 'Casa', recipient: '', phone: '', state: '', city: '', line: '', reference: '', is_default: false };

export function Addresses() {
  const { toast } = useApp();
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const load = () => api.get('/account/addresses').then(setList);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setErrors({}); setError('');
    try {
      if (edit.id) await api.put(`/account/addresses/${edit.id}`, edit); else await api.post('/account/addresses', edit);
      setEdit(null); load(); toast('Dirección guardada');
    } catch (err) { setErrors(err.details); setError(err.message); }
  };
  const remove = async (id) => { if (window.confirm('¿Eliminar esta dirección?')) { await api.del(`/account/addresses/${id}`); load(); } };
  const f = (k) => ({ value: edit?.[k] || '', error: errors[k], onChange: (e) => setEdit({ ...edit, [k]: e.target.value }) });

  if (!list) return <Loading />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-3xl font-bold">Direcciones</h2>
        <button className="btn-primary btn-sm" onClick={() => { setErrors({}); setError(''); setEdit({ ...EMPTY_ADDRESS }); }}><Icon name="plus" className="size-4" /> Nueva</button>
      </div>
      {list.length === 0 ? <Empty icon="pin" title="Sin direcciones guardadas" /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <div key={a.id} className="card p-4 text-sm">
              <div className="mb-1 flex items-center gap-2"><b>{a.label}</b>{a.is_default && <Badge color="brand">Principal</Badge>}</div>
              <p>{a.recipient} · {a.phone}</p><p className="text-ink-500">{a.line}, {a.city}, {a.state}</p>
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost btn-sm" onClick={() => { setErrors({}); setEdit(a); }}>Editar</button>
                <button className="btn-ghost btn-sm text-red-600!" onClick={() => remove(a.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar dirección' : 'Nueva dirección'}>
        {edit && (
          <form onSubmit={save} className="space-y-3" noValidate>
            <FormError error={error} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre de la dirección"><Input {...f('label')} /></Field>
              <Field label="Quien recibe" error={errors.recipient}><Input {...f('recipient')} /></Field>
              <Field label="Teléfono" error={errors.phone}><Input type="tel" {...f('phone')} /></Field>
              <Field label="Estado" error={errors.state}><Select {...f('state')}><option value="">Selecciona</option>{VE_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Ciudad" error={errors.city}><Input {...f('city')} /></Field>
              <Field label="Punto de referencia"><Input {...f('reference')} /></Field>
            </div>
            <Field label="Dirección" error={errors.line}><Input {...f('line')} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={!!edit.is_default} onChange={(e) => setEdit({ ...edit, is_default: e.target.checked })} /> Usar como principal</label>
            <button className="btn-primary w-full">Guardar</button>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function Profile() {
  const { user, setUser, toast } = useApp();
  const [form, setForm] = useState({ name: user.name, doc_id: user.doc_id || '', phone: user.phone || '' });
  const [pw, setPw] = useState({ current: '', password: '' });
  const [errors, setErrors] = useState({});
  const [pwErrors, setPwErrors] = useState({});

  const save = async (e) => {
    e.preventDefault(); setErrors({});
    try { setUser(await api.put('/auth/me', form)); toast('Datos actualizados'); } catch (err) { setErrors(err.details); toast(err.message, 'error'); }
  };
  const changePw = async (e) => {
    e.preventDefault(); setPwErrors({});
    try { await api.put('/auth/password', pw); setPw({ current: '', password: '' }); toast('Contraseña actualizada'); } catch (err) { setPwErrors(err.details); toast(err.message, 'error'); }
  };
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <form onSubmit={save} className="card space-y-3 p-5" noValidate>
        <h2 className="text-2xl font-bold">Mis datos</h2>
        <Field label="Correo"><Input value={user.email} disabled /></Field>
        <Field label="Nombre" error={errors.name}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Cédula / RIF" error={errors.doc_id}><Input value={form.doc_id} onChange={(e) => setForm({ ...form, doc_id: e.target.value })} /></Field>
        <Field label="Teléfono" error={errors.phone}><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <button className="btn-primary">Guardar</button>
      </form>
      <form onSubmit={changePw} className="card h-fit space-y-3 p-5" noValidate>
        <h2 className="text-2xl font-bold">Cambiar contraseña</h2>
        <Field label="Contraseña actual" error={pwErrors.current}><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
        <Field label="Nueva contraseña" error={pwErrors.password} hint="Mínimo 8 caracteres"><Input type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
        <button className="btn-dark">Actualizar contraseña</button>
      </form>
    </div>
  );
}
