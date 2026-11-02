// Módulos del panel: compatibilidad, inventario, pedidos, clientes, compras,
// promociones, reportes, usuarios y configuración.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, download, qs } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { bs, date, dateTime, STATUS, CUSTOMER_TYPES } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import { Badge, Empty, Field, FormError, Input, Loading, Modal, Pagination, Select, Textarea } from '../components/ui.jsx';
import { StatusBadge } from '../pages/account/Account.jsx';
import { PageHeader } from './AdminLayout.jsx';
import CrudPage from './CrudPage.jsx';
import ProductPicker from './ProductPicker.jsx';

/** Pestañas simples sincronizadas con ?tab= */
function Tabs({ tabs }) {
  const [params, setParams] = useSearchParams();
  const current = params.get('tab') || tabs[0][0];
  const active = tabs.find((t) => t[0] === current) || tabs[0];
  return (
    <>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-200 dark:border-ink-800" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={k === active[0]} onClick={() => setParams({ tab: k })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold whitespace-nowrap ${k === active[0] ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-800 dark:hover:text-ink-200'}`}>
            {l}
          </button>
        ))}
      </div>
      {active[2]}
    </>
  );
}

const yesNo = (v) => (v ? <Badge color="green">Sí</Badge> : <Badge>No</Badge>);

// =====================================================================
// Compatibilidad: marcas → modelos → versiones (año + motor)
// =====================================================================
export function Compat() {
  const { toast } = useApp();
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [make, setMake] = useState(null);
  const [model, setModel] = useState(null);
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');
  const [range, setRange] = useState({ year_from: '', year_to: '', engines: '' });
  const [errors, setErrors] = useState({});

  const loadMakes = () => api.get('/admin/compat/makes').then(setMakes);
  const loadModels = (m = make) => m && api.get(`/admin/compat/models?make_id=${m.id}`).then(setModels);
  const loadVehicles = (m = model) => m && api.get(`/admin/compat/vehicles?model_id=${m.id}`).then(setVehicles);
  useEffect(() => { loadMakes(); }, []);
  useEffect(() => { setModel(null); setVehicles([]); loadModels(); }, [make]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadVehicles(); }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, ok) => {
    setErrors({});
    try { await fn(); if (ok) toast(ok); } catch (e) { setErrors(e.details); toast(e.message, 'error'); }
  };
  const del = (url, reload, what) => window.confirm(`¿Eliminar ${what}? También se quitará de la compatibilidad de los productos.`) &&
    run(async () => { await api.del(url); reload(); }, 'Eliminado');

  const col = 'card flex flex-col overflow-hidden';
  const item = (active) => `flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm ${active ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-brand-300' : 'hover:bg-ink-50 dark:hover:bg-ink-850'}`;

  // Agrupa las versiones por motor para mostrarlas como rangos de años
  const byEngine = vehicles.reduce((acc, v) => ((acc[v.engine] ||= []).push(v), acc), {});

  return (
    <div>
      <PageHeader title="Compatibilidad" />
      <p className="mb-4 text-sm text-ink-500">Catálogo de vehículos que usa el buscador de la tienda: Marca → Modelo → Año → Motor.</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
        <section className={col}>
          <h2 className="border-b border-ink-200 px-4 py-3 text-xl font-bold dark:border-ink-800">1. Marcas</h2>
          <form className="flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post('/admin/compat/makes', { name: newMake }); setNewMake(''); loadMakes(); }, 'Marca creada'); }}>
            <Input placeholder="Nueva marca" value={newMake} onChange={(e) => setNewMake(e.target.value)} />
            <button className="btn-dark" aria-label="Agregar marca"><Icon name="plus" className="size-4" /></button>
          </form>
          <ul className="max-h-[60vh] overflow-y-auto">
            {makes.map((m) => (
              <li key={m.id} className="group flex items-center">
                <button className={item(make?.id === m.id)} onClick={() => setMake(m)}>{m.name}<span className="text-xs text-ink-400">{m.model_count}</span></button>
                <button className="hidden px-2 text-red-600 group-hover:block" onClick={() => del(`/admin/compat/makes/${m.id}`, loadMakes, `la marca ${m.name}`)} aria-label="Eliminar"><Icon name="trash" className="size-4" /></button>
              </li>
            ))}
          </ul>
        </section>

        <section className={col}>
          <h2 className="border-b border-ink-200 px-4 py-3 text-xl font-bold dark:border-ink-800">2. Modelos {make && <span className="text-ink-400">· {make.name}</span>}</h2>
          {!make ? <p className="p-4 text-sm text-ink-500">Selecciona una marca.</p> : (
            <>
              <form className="flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post('/admin/compat/models', { make_id: make.id, name: newModel }); setNewModel(''); loadModels(); loadMakes(); }, 'Modelo creado'); }}>
                <Input placeholder="Nuevo modelo" value={newModel} onChange={(e) => setNewModel(e.target.value)} />
                <button className="btn-dark" aria-label="Agregar modelo"><Icon name="plus" className="size-4" /></button>
              </form>
              <ul className="max-h-[60vh] overflow-y-auto">
                {models.map((m) => (
                  <li key={m.id} className="group flex items-center">
                    <button className={item(model?.id === m.id)} onClick={() => setModel(m)}>
                      {m.name}<span className="text-xs text-ink-400">{m.year_from ? `${m.year_from}–${m.year_to}` : 'sin años'}</span>
                    </button>
                    <button className="hidden px-2 text-red-600 group-hover:block" onClick={() => del(`/admin/compat/models/${m.id}`, () => loadModels(), `el modelo ${m.name}`)} aria-label="Eliminar"><Icon name="trash" className="size-4" /></button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={col}>
          <h2 className="border-b border-ink-200 px-4 py-3 text-xl font-bold dark:border-ink-800">3. Años y motores {model && <span className="text-ink-400">· {model.name}</span>}</h2>
          {!model ? <p className="p-4 text-sm text-ink-500">Selecciona un modelo.</p> : (
            <div className="p-3">
              <form className="grid grid-cols-2 gap-2 sm:grid-cols-4" noValidate
                onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api.post('/admin/compat/vehicles', { model_id: model.id, ...range }); toast(`${r.created} versiones creadas`); loadVehicles(); loadModels(); }); }}>
                <Field error={errors.year_from}><Input type="number" placeholder="Año desde" value={range.year_from} onChange={(e) => setRange({ ...range, year_from: e.target.value })} /></Field>
                <Field error={errors.year_to}><Input type="number" placeholder="Año hasta" value={range.year_to} onChange={(e) => setRange({ ...range, year_to: e.target.value })} /></Field>
                <Field error={errors.engines} className="col-span-2"><Input placeholder="Motores, separados por coma" value={range.engines} onChange={(e) => setRange({ ...range, engines: e.target.value })} /></Field>
                <button className="btn-dark col-span-2 sm:col-span-4"><Icon name="plus" className="size-4" /> Crear versiones</button>
              </form>
              <div className="mt-3 max-h-[50vh] space-y-3 overflow-y-auto">
                {Object.entries(byEngine).map(([engine, list]) => (
                  <div key={engine}>
                    <h3 className="mb-1 font-sans text-sm font-bold">{engine}</h3>
                    <div className="flex flex-wrap gap-1">
                      {list.map((v) => (
                        <span key={v.id} className="group inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-1 text-xs dark:bg-ink-800" title={`${v.product_count} productos compatibles`}>
                          {v.year} <span className="text-ink-400">({v.product_count})</span>
                          <button onClick={() => del(`/admin/compat/vehicles/${v.id}`, () => loadVehicles(), `${model.name} ${v.year}`)} className="text-ink-400 hover:text-red-600" aria-label={`Eliminar ${v.year}`}><Icon name="x" className="size-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {vehicles.length === 0 && <p className="text-sm text-ink-500">Sin versiones. Crea un rango de años con sus motores.</p>}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// =====================================================================
// Inventario
// =====================================================================
const MOV = { entrada: ['Entrada', 'green'], salida: ['Salida', 'red'], ajuste: ['Ajuste', 'violet'], venta: ['Venta', 'blue'], devolucion: ['Devolución', 'amber'], compra: ['Compra', 'sky'] };

function Movements() {
  const [filters, setFilters] = useState({ type: '', q: '', from: '', to: '', page: 1 });
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/admin/inventory/movements${qs(filters)}`).then(setData); }, [filters]);
  const set = (k, v) => setFilters({ ...filters, [k]: v, page: k === 'page' ? v : 1 });
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Producto o SKU" onKeyDown={(e) => e.key === 'Enter' && set('q', e.target.value)} aria-label="Buscar" />
        <select className="input w-auto" value={filters.type} onChange={(e) => set('type', e.target.value)} aria-label="Tipo">
          <option value="">Todos los tipos</option>{Object.entries(MOV).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input type="date" className="input w-auto" value={filters.from} onChange={(e) => set('from', e.target.value)} aria-label="Desde" />
        <input type="date" className="input w-auto" value={filters.to} onChange={(e) => set('to', e.target.value)} aria-label="Hasta" />
      </div>
      {!data ? <Loading /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="text-right">Cantidad</th><th className="text-right">Stock</th><th>Motivo</th><th>Usuario</th></tr></thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs whitespace-nowrap text-ink-500">{dateTime(m.created_at)}</td>
                    <td><b className="text-xs">{m.sku}</b> <span className="text-sm">{m.product_name}</span></td>
                    <td><Badge color={MOV[m.type][1]}>{MOV[m.type][0]}</Badge></td>
                    <td className={`text-right font-semibold ${m.quantity > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                    <td className="text-right">{m.stock_after}</td>
                    <td className="text-xs">{m.reason}{m.reference && <span className="text-ink-400"> · {m.reference}</span>}</td>
                    <td className="text-xs text-ink-500">{m.user_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => set('page', p)} />
        </>
      )}
    </div>
  );
}

function NewMovement() {
  const { toast } = useApp();
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ type: 'entrada', quantity: '', reason: '', reference: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault(); setErrors({}); setError('');
    try {
      const r = await api.post('/admin/inventory/movements', { ...form, product_id: product?.id });
      toast(`Movimiento registrado. Stock actual: ${r.stock}`);
      setProduct(null); setForm({ ...form, quantity: '', reason: '', reference: '' });
    } catch (err) { setErrors(err.details); setError(err.message); }
  };
  return (
    <form onSubmit={save} className="card max-w-xl space-y-3 p-5" noValidate>
      <FormError error={error} />
      <Field label="Producto" error={errors.product_id}><ProductPicker value={product} onChange={setProduct} /></Field>
      {product && <p className="text-sm text-ink-500">Stock actual: <b>{product.stock}</b> · mínimo {product.min_stock} · ubicación {product.warehouse_location || '—'}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo" error={errors.type}>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="entrada">Entrada (+)</option><option value="salida">Salida (−)</option><option value="ajuste">Ajuste por conteo</option>
          </Select>
        </Field>
        <Field label={form.type === 'ajuste' ? 'Stock contado' : 'Cantidad'} error={errors.quantity}>
          <Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </Field>
      </div>
      <Field label="Motivo" error={errors.reason}><Input placeholder="Ej: mercancía dañada, conteo físico, uso en taller" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
      <Field label="Referencia (opcional)"><Input placeholder="N.º de factura, guía, etc." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
      <button className="btn-primary w-full">Registrar movimiento</button>
    </form>
  );
}

function LowStock() {
  const [list, setList] = useState(null);
  useEffect(() => { api.get('/admin/inventory/low-stock').then(setList); }, []);
  if (!list) return <Loading />;
  if (!list.length) return <Empty icon="check" title="Sin alertas">Todos los productos están sobre su stock mínimo.</Empty>;
  return (
    <div className="card overflow-x-auto">
      <table className="table-base">
        <thead><tr><th>Producto</th><th>Marca</th><th>Ubicación</th><th className="text-right">Stock</th><th className="text-right">Mínimo</th><th className="text-right">Pedir sugerido</th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td><Link to={`/admin/productos/${p.id}`} className="hover:underline"><b className="text-xs">{p.sku}</b> {p.name}</Link></td>
              <td>{p.brand_name}</td><td>{p.warehouse_location || '—'}</td>
              <td className={`text-right font-bold ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>{p.stock}</td>
              <td className="text-right">{p.min_stock}</td><td className="text-right">{p.suggested_order}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="p-3 text-xs text-ink-500">Para reponer, crea una orden de compra en <Link to="/admin/compras?tab=ordenes" className="underline">Proveedores y compras</Link>.</p>
    </div>
  );
}

export function Inventory() {
  return (
    <div>
      <PageHeader title="Inventario" />
      <Tabs tabs={[['movimientos', 'Historial de movimientos', <Movements key="m" />], ['nuevo', 'Entrada / salida / ajuste', <NewMovement key="n" />], ['bajo', 'Alertas de stock bajo', <LowStock key="b" />]]} />
    </div>
  );
}

// =====================================================================
// Pedidos
// =====================================================================
export function Orders() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const filters = Object.fromEntries(params);
  useEffect(() => { api.get(`/admin/orders${qs(filters)}`).then(setData); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); };
  const count = (s) => data?.counts.find((c) => c.status === s)?.count || 0;

  return (
    <div>
      <PageHeader title="Pedidos" />
      <div className="mb-3 flex gap-1 overflow-x-auto">
        <button className={`btn-sm rounded-full ${!params.get('status') ? 'btn-dark' : 'btn-ghost'}`} onClick={() => set('status', '')}>Todos</button>
        {Object.entries(STATUS).map(([k, s]) => (
          <button key={k} className={`btn-sm rounded-full whitespace-nowrap ${params.get('status') === k ? 'btn-dark' : 'btn-ghost'}`} onClick={() => set('status', k)}>
            {s.label} <span className="opacity-60">{count(k)}</span>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Código, cliente, cédula o correo" defaultValue={params.get('q') || ''} onKeyDown={(e) => e.key === 'Enter' && set('q', e.target.value)} aria-label="Buscar" />
        <select className="input w-auto" value={params.get('delivery_type') || ''} onChange={(e) => set('delivery_type', e.target.value)} aria-label="Entrega">
          <option value="">Envío y retiro</option><option value="envio">Envío</option><option value="retiro">Retiro en tienda</option>
        </select>
        <input type="date" className="input w-auto" value={params.get('from') || ''} onChange={(e) => set('from', e.target.value)} aria-label="Desde" />
        <input type="date" className="input w-auto" value={params.get('to') || ''} onChange={(e) => set('to', e.target.value)} aria-label="Hasta" />
      </div>
      {!data ? <Loading /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th>Entrega</th><th>Estado</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/admin/pedidos/${o.id}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-400">{o.code}</Link></td>
                    <td className="text-xs whitespace-nowrap text-ink-500">{dateTime(o.created_at)}</td>
                    <td>{o.customer_name}{o.customer_type !== 'normal' && <Badge color="blue" className="ml-1">{CUSTOMER_TYPES[o.customer_type]}</Badge>}</td>
                    <td className="text-xs">{o.payment_method_name}{o.payment_reference && <div className="text-ink-400">Ref. {o.payment_reference}</div>}</td>
                    <td className="text-xs">{o.delivery_type === 'retiro' ? 'Retiro' : 'Envío'}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right font-semibold">{bs(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.items.length === 0 && <Empty icon="receipt" title="Sin pedidos con estos filtros" />}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => set('page', String(p))} />
        </>
      )}
    </div>
  );
}

const NEXT_LABEL = { pagado: 'Confirmar pago', preparacion: 'Pasar a preparación', enviado: 'Marcar como enviado', entregado: 'Marcar como entregado', cancelado: 'Cancelar pedido' };

export function OrderDetail() {
  const { id } = useParams();
  const { toast } = useApp();
  const [o, setO] = useState(null);
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({ note: '', carrier: '', tracking_number: '' });
  const [errors, setErrors] = useState({});
  useEffect(() => { api.get(`/admin/orders/${id}`).then(setO); }, [id]);
  if (!o) return <Loading />;

  const apply = async (e) => {
    e.preventDefault(); setErrors({});
    try {
      setO(await api.post(`/admin/orders/${id}/status`, { status: action, ...form }));
      toast(`Pedido actualizado: ${STATUS[action].label}`);
      setAction(null); setForm({ note: '', carrier: '', tracking_number: '' });
    } catch (err) { setErrors(err.details); toast(err.message, 'error'); }
  };
  const a = o.shipping_address;

  return (
    <div>
      <PageHeader title={`Pedido ${o.code}`}>
        <button className="btn-ghost btn-sm" onClick={() => download(`/orders/${o.code}/invoice`, `${o.code}.pdf`, { open: true }).catch((e) => toast(e.message, 'error'))}>
          <Icon name="printer" className="size-4" /> Imprimir comprobante
        </button>
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <StatusBadge status={o.status} /> <span className="text-sm text-ink-500">{dateTime(o.created_at)}</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {o.next_statuses.map((s) => (
                <button key={s} className={s === 'cancelado' ? 'btn-ghost btn-sm text-red-600!' : 'btn-primary btn-sm'} onClick={() => { setErrors({}); setForm({ note: '', carrier: o.carrier || (o.zone_name?.includes('MACAI') ? 'Delivery MACAI' : 'MRW'), tracking_number: o.tracking_number || '' }); setAction(s); }}>
                  {NEXT_LABEL[s]}
                </button>
              ))}
              {o.next_statuses.length === 0 && <span className="text-sm text-ink-500">Pedido cerrado</span>}
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Producto</th><th className="text-right">Cant.</th><th className="text-right">Precio</th><th className="text-right">Costo</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id}>
                    <td><b className="text-xs">{i.sku}</b> {i.name}</td><td className="text-right">{i.quantity}</td>
                    <td className="text-right">{bs(i.unit_price)}</td><td className="text-right text-ink-400">{bs(i.unit_cost)}</td><td className="text-right font-semibold">{bs(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto max-w-xs space-y-1 p-4 text-sm">
              {[['Subtotal', o.subtotal], ['Descuento', -o.discount], ['IVA', o.tax], ['Envío', o.shipping_cost]].map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-ink-500">{l}</span><span>{bs(v)}</span></div>)}
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-bold dark:border-ink-700"><span>Total</span><span>{bs(o.total)}</span></div>
              <div className="flex justify-between text-xs text-ink-500"><span>Utilidad bruta</span><span>{bs(o.items.reduce((s, i) => s + i.total - i.unit_cost * i.quantity, 0) - o.discount)}</span></div>
            </div>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 text-xl font-bold">Historial</h2>
            <ol className="space-y-3 border-l-2 border-ink-200 pl-4 dark:border-ink-700">
              {o.history.map((h) => (
                <li key={h.id} className="relative text-sm">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-brand-600" />
                  <b>{STATUS[h.status].label}</b> <span className="text-xs text-ink-400">{dateTime(h.created_at)}{h.user_name && ` · ${h.user_name}`}</span>
                  {h.note && <p className="text-ink-500">{h.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card space-y-1 p-4 text-sm">
            <h2 className="mb-2 text-xl font-bold">Cliente</h2>
            <p className="font-semibold">{o.customer_name} {o.customer_type !== 'normal' && <Badge color="blue">{CUSTOMER_TYPES[o.customer_type]}</Badge>}</p>
            <p>{o.customer_doc}</p><p>{o.customer_phone}</p><p>{o.customer_email}</p>
            <a className="mt-2 inline-flex items-center gap-1 font-semibold text-green-700 hover:underline dark:text-green-400" target="_blank" rel="noreferrer"
              href={`https://wa.me/58${o.customer_phone.replace(/\D/g, '').replace(/^(58)?0?/, '')}?text=${encodeURIComponent(`Hola ${o.customer_name}, te escribimos de MACAI por tu pedido ${o.code}.`)}`}>
              <Icon name="whatsapp" className="size-4" /> Escribir por WhatsApp
            </a>
          </div>
          <div className="card space-y-1 p-4 text-sm">
            <h2 className="mb-2 text-xl font-bold">Pago</h2>
            <p>{o.payment_method_name}</p>
            {o.payment_reference && <p>Referencia: <b>{o.payment_reference}</b></p>}
            {o.coupon_code && <p>Cupón: <b>{o.coupon_code}</b></p>}
          </div>
          <div className="card space-y-1 p-4 text-sm">
            <h2 className="mb-2 text-xl font-bold">Entrega</h2>
            {o.delivery_type === 'retiro' ? <p>Retiro en tienda</p> : (
              <>
                <p>{a?.recipient} · {a?.phone}</p><p>{a?.line}</p><p>{a?.city}, {a?.state}</p>{a?.reference && <p className="text-ink-500">Ref.: {a.reference}</p>}
                <p className="text-ink-500">{o.zone_name} · {o.est_days}</p>
                {o.tracking_number && <p className="mt-2">Guía: <b>{o.carrier} {o.tracking_number}</b></p>}
              </>
            )}
          </div>
          {o.notes && <div className="card p-4 text-sm"><h2 className="mb-1 text-xl font-bold">Notas del cliente</h2><p>{o.notes}</p></div>}
        </div>
      </div>

      <Modal open={!!action} onClose={() => setAction(null)} title={action ? NEXT_LABEL[action] : ''}>
        <form onSubmit={apply} className="space-y-3" noValidate>
          {action === 'cancelado' && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">Al cancelar, el stock de los productos se devuelve al inventario.</p>}
          {action === 'enviado' && o.delivery_type === 'envio' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Empresa de envío"><Select value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })}>
                {['Delivery MACAI', 'MRW', 'Zoom', 'Tealca', 'Domesa'].map((c) => <option key={c}>{c}</option>)}
              </Select></Field>
              <Field label="N.º de guía" error={errors.tracking_number}><Input value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} /></Field>
            </div>
          )}
          <Field label="Nota (visible en el historial)"><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={action === 'pagado' ? 'Ej: pago verificado en Banco de Venezuela' : ''} /></Field>
          <button className={action === 'cancelado' ? 'btn-danger w-full' : 'btn-primary w-full'}>Confirmar</button>
        </form>
      </Modal>
    </div>
  );
}

// =====================================================================
// Clientes
// =====================================================================
export function Customers() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const filters = Object.fromEntries(params);
  const load = () => api.get(`/admin/customers${qs(filters)}`).then(setData);
  useEffect(() => { load(); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); };

  const changeType = async (type) => {
    try {
      await api.put(`/admin/customers/${detail.id}`, { customer_type: type });
      setDetail({ ...detail, customer_type: type }); load();
      toast(`Cliente actualizado a ${CUSTOMER_TYPES[type]}`);
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Clientes" />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Nombre, correo o cédula" onKeyDown={(e) => e.key === 'Enter' && set('q', e.target.value)} aria-label="Buscar" />
        <select className="input w-auto" value={params.get('type') || ''} onChange={(e) => set('type', e.target.value)} aria-label="Tipo">
          <option value="">Todos los tipos</option>{Object.entries(CUSTOMER_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {!data ? <Loading /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Cliente</th><th>Cédula/RIF</th><th>Teléfono</th><th>Tipo</th><th className="text-right">Pedidos</th><th className="text-right">Total comprado</th><th>Última compra</th></tr></thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => api.get(`/admin/customers/${c.id}`).then(setDetail)}>
                    <td><b>{c.name}</b><div className="text-xs text-ink-400">{c.email}</div></td>
                    <td>{c.doc_id || '—'}</td><td>{c.phone || '—'}</td>
                    <td><Badge color={c.customer_type === 'normal' ? 'gray' : 'blue'}>{CUSTOMER_TYPES[c.customer_type]}</Badge></td>
                    <td className="text-right">{c.orders}</td><td className="text-right font-semibold">{bs(c.spent)}</td>
                    <td className="text-xs text-ink-500">{c.last_order ? date(c.last_order) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => set('page', String(p))} />
        </>
      )}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || ''} size="max-w-2xl">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>{detail.email}<br />{detail.doc_id} · {detail.phone}<br /><span className="text-ink-400">Cliente desde {date(detail.created_at)}</span></p>
              <Field label="Tipo de cliente (define sus precios)">
                <Select value={detail.customer_type} onChange={(e) => changeType(e.target.value)}>
                  {Object.entries(CUSTOMER_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
            </div>
            {detail.vehicles.length > 0 && <p><b>Vehículos:</b> {detail.vehicles.map((v) => `${v.make} ${v.model} ${v.year}`).join(' · ')}</p>}
            {detail.top_products.length > 0 && <p><b>Lo que más compra:</b> {detail.top_products.map((p) => `${p.name} (${p.qty})`).join(' · ')}</p>}
            <h3 className="text-lg font-bold">Historial de compras</h3>
            <table className="table-base">
              <tbody>
                {detail.orders.map((o) => (
                  <tr key={o.id}><td><Link to={`/admin/pedidos/${o.id}`} className="font-semibold hover:underline">{o.code}</Link></td><td>{date(o.created_at)}</td><td><StatusBadge status={o.status} /></td><td className="text-right">{bs(o.total)}</td></tr>
                ))}
              </tbody>
            </table>
            {detail.orders.length === 0 && <p className="text-ink-500">Aún no tiene pedidos.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

// =====================================================================
// Proveedores y órdenes de compra
// =====================================================================
const PO_STATUS = { borrador: ['Borrador', 'gray'], enviada: ['Enviada', 'blue'], recibida: ['Recibida', 'green'], cancelada: ['Cancelada', 'red'] };

function PurchaseOrders() {
  const { toast } = useApp();
  const [list, setList] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');
  const load = () => api.get('/admin/purchasing/purchase-orders').then(setList);
  useEffect(() => { load(); api.get('/admin/purchasing/suppliers').then(setSuppliers); }, []);

  const open = async (po) => {
    setError('');
    if (!po) return setEdit({ supplier_id: '', notes: '', items: [] });
    const full = await api.get(`/admin/purchasing/purchase-orders/${po.id}`);
    setEdit({ ...full, items: full.items.map((i) => ({ product: { id: i.product_id, name: i.name, sku: i.sku, stock: i.stock }, quantity: i.quantity, unit_cost: i.unit_cost })) });
  };
  const readOnly = edit?.id && !['borrador', 'enviada'].includes(edit.status);
  const total = (edit?.items || []).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_cost || 0), 0);

  const save = async (e) => {
    e.preventDefault(); setError('');
    const body = { supplier_id: edit.supplier_id, notes: edit.notes, items: edit.items.filter((i) => i.product).map((i) => ({ product_id: i.product.id, quantity: i.quantity, unit_cost: i.unit_cost })) };
    try {
      if (edit.id) await api.put(`/admin/purchasing/purchase-orders/${edit.id}`, body); else await api.post('/admin/purchasing/purchase-orders', body);
      toast('Orden de compra guardada'); setEdit(null); load();
    } catch (err) { setError(err.details ? Object.values(err.details).join('. ') : err.message); }
  };
  const status = async (s) => {
    if (s === 'recibida' && !window.confirm('Se sumarán las cantidades al inventario y se actualizará el costo de cada producto. ¿Continuar?')) return;
    try { await api.post(`/admin/purchasing/purchase-orders/${edit.id}/status`, { status: s }); toast(`Orden ${PO_STATUS[s][0].toLowerCase()}`); setEdit(null); load(); }
    catch (err) { toast(err.message, 'error'); }
  };
  const setItem = (i, k, v) => setEdit({ ...edit, items: edit.items.map((x, j) => (j === i ? { ...x, [k]: v, ...(k === 'product' && v ? { unit_cost: v.cost_price } : {}) } : x)) });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Órdenes de compra</h2>
        <button className="btn-primary btn-sm" onClick={() => open(null)}><Icon name="plus" className="size-4" /> Nueva orden</button>
      </div>
      {!list ? <Loading /> : list.length === 0 ? <Empty title="Sin órdenes de compra" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Código</th><th>Proveedor</th><th>Fecha</th><th>Productos</th><th>Estado</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {list.map((po) => (
                <tr key={po.id} className="cursor-pointer" onClick={() => open(po)}>
                  <td className="font-semibold">{po.code}</td><td>{po.supplier_name}</td><td className="text-xs">{date(po.created_at)}</td>
                  <td>{po.item_count}</td><td><Badge color={PO_STATUS[po.status][1]}>{PO_STATUS[po.status][0]}</Badge></td><td className="text-right font-semibold">{bs(po.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.code ? `Orden ${edit.code}` : 'Nueva orden de compra'} size="max-w-3xl">
        {edit && (
          <form onSubmit={save} className="space-y-3" noValidate>
            <FormError error={error} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Proveedor">
                <Select value={edit.supplier_id} disabled={readOnly} onChange={(e) => setEdit({ ...edit, supplier_id: e.target.value })}>
                  <option value="">Selecciona</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Notas"><Input value={edit.notes || ''} disabled={readOnly} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            </div>
            <div className="space-y-2">
              {edit.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_120px_32px] items-start gap-2">
                  {readOnly ? <span className="py-2 text-sm">{it.product?.sku} · {it.product?.name}</span> : <ProductPicker value={it.product} onChange={(p) => setItem(i, 'product', p)} />}
                  <Input type="number" min="1" value={it.quantity} disabled={readOnly} onChange={(e) => setItem(i, 'quantity', e.target.value)} aria-label="Cantidad" />
                  <Input type="number" min="0" step="0.01" value={it.unit_cost} disabled={readOnly} onChange={(e) => setItem(i, 'unit_cost', e.target.value)} aria-label="Costo unitario" />
                  {!readOnly && <button type="button" className="p-2 text-red-600" onClick={() => setEdit({ ...edit, items: edit.items.filter((_, j) => j !== i) })} aria-label="Quitar"><Icon name="x" className="size-4" /></button>}
                </div>
              ))}
              {!readOnly && <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit({ ...edit, items: [...edit.items, { product: null, quantity: 1, unit_cost: '' }] })}><Icon name="plus" className="size-4" /> Agregar producto</button>}
              <p className="text-right font-display text-2xl font-bold">Total {bs(total)}</p>
            </div>
            {!readOnly && <button className="btn-primary w-full">Guardar orden</button>}
            {edit.id && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-ink-200 pt-3 dark:border-ink-800">
                {edit.status === 'borrador' && <button type="button" className="btn-dark btn-sm" onClick={() => status('enviada')}>Marcar como enviada al proveedor</button>}
                {edit.status === 'enviada' && <button type="button" className="btn-primary btn-sm" onClick={() => status('recibida')}>Recibir mercancía</button>}
                {['borrador', 'enviada'].includes(edit.status) && <button type="button" className="btn-ghost btn-sm text-red-600!" onClick={() => status('cancelada')}>Cancelar orden</button>}
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

export function Purchasing() {
  return (
    <div>
      <PageHeader title="Proveedores y compras" />
      <Tabs tabs={[
        ['ordenes', 'Órdenes de compra', <PurchaseOrders key="o" />],
        ['proveedores', 'Proveedores', <CrudPage key="p" title="Proveedores" singular="proveedor" endpoint="/admin/purchasing/suppliers" defaults={{ active: true }}
          columns={[{ key: 'name', label: 'Razón social', render: (r) => <b>{r.name}</b> }, { key: 'rif', label: 'RIF' }, { key: 'contact', label: 'Contacto' }, { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Correo' }, { key: 'active', label: 'Activo', render: (r) => yesNo(r.active) }]}
          fields={[{ key: 'name', label: 'Razón social', span: 2 }, { key: 'rif', label: 'RIF', hint: 'J-12345678-9' }, { key: 'contact', label: 'Persona de contacto' }, { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Correo' }, { key: 'address', label: 'Dirección', span: 2 }, { key: 'notes', label: 'Notas', type: 'textarea' }, { key: 'active', label: 'Proveedor activo', type: 'checkbox' }]} />],
      ]} />
    </div>
  );
}

// =====================================================================
// Promociones
// =====================================================================
export function Promotions() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  useEffect(() => {
    api.get('/categories').then(setCategories);
    api.get('/admin/products?limit=100&sort=name').then((r) => setProducts(r.items));
  }, []);
  const vigencia = (r) => `${r.starts_at ? date(r.starts_at) : 'Ya'} → ${r.ends_at ? date(r.ends_at) : 'sin fin'}`;
  return (
    <div>
      <PageHeader title="Promociones" />
      <Tabs tabs={[
        ['ofertas', 'Descuentos y ofertas', <CrudPage key="p" title="Descuentos por categoría o producto" singular="promoción" endpoint="/admin/marketing/promotions"
          defaults={{ scope: 'category', active: true, banner: false }}
          columns={[{ key: 'name', label: 'Nombre', render: (r) => <b>{r.name}</b> }, { key: 'scope', label: 'Aplica a', render: (r) => r.category_name || r.product_name },
            { key: 'percent', label: 'Desc.', render: (r) => `${Number(r.percent)}%` }, { key: 'ends_at', label: 'Vigencia', render: vigencia },
            { key: 'running', label: 'Estado', render: (r) => (r.running ? <Badge color="green">En curso</Badge> : <Badge>Inactiva</Badge>) }, { key: 'banner', label: 'Banner', render: (r) => yesNo(r.banner) }]}
          fields={[{ key: 'name', label: 'Nombre', span: 2 }, { key: 'scope', label: 'Aplica a', type: 'select', options: [['category', 'Una categoría'], ['product', 'Un producto']] },
            { key: 'percent', label: 'Descuento %', type: 'number' },
            { key: 'category_id', label: 'Categoría', type: 'select', options: categories.map((c) => [c.id, c.name]), showIf: (f) => f.scope === 'category', span: 2 },
            { key: 'product_id', label: 'Producto', type: 'select', options: products.map((p) => [p.id, `${p.sku} · ${p.name}`]), showIf: (f) => f.scope === 'product', span: 2 },
            { key: 'starts_at', label: 'Inicio', type: 'datetime' }, { key: 'ends_at', label: 'Fin', type: 'datetime' },
            { key: 'banner', label: 'Mostrar en el banner de inicio (con cuenta regresiva)', type: 'checkbox' }, { key: 'active', label: 'Activa', type: 'checkbox' }]} />],
        ['cupones', 'Cupones', <CrudPage key="c" title="Cupones de descuento" singular="cupón" endpoint="/admin/marketing/coupons" defaults={{ type: 'percent', active: true, min_order: 0 }}
          columns={[{ key: 'code', label: 'Código', render: (r) => <b className="font-mono">{r.code}</b> }, { key: 'value', label: 'Descuento', render: (r) => (r.type === 'percent' ? `${Number(r.value)}%` : bs(r.value)) },
            { key: 'min_order', label: 'Compra mín.', render: (r) => bs(r.min_order) }, { key: 'used_count', label: 'Usos', render: (r) => `${r.used_count}${r.max_uses ? ` / ${r.max_uses}` : ''}` },
            { key: 'ends_at', label: 'Vigencia', render: vigencia },
            { key: 'active', label: 'Estado', render: (r) => (!r.active ? <Badge>Inactivo</Badge> : r.ends_at && new Date(r.ends_at) < new Date() ? <Badge color="red">Vencido</Badge> : <Badge color="green">Activo</Badge>) }]}
          fields={[{ key: 'code', label: 'Código', hint: 'Sin espacios, ej. BIENVENIDO10' }, { key: 'type', label: 'Tipo', type: 'select', options: [['percent', 'Porcentaje (%)'], ['fixed', 'Monto fijo (Bs.)']] },
            { key: 'value', label: 'Valor', type: 'number' }, { key: 'min_order', label: 'Compra mínima (Bs.)', type: 'number' }, { key: 'max_uses', label: 'Usos máximos', type: 'number', hint: 'Vacío = ilimitado' },
            { key: 'starts_at', label: 'Desde', type: 'datetime' }, { key: 'ends_at', label: 'Hasta', type: 'datetime' }, { key: 'active', label: 'Activo', type: 'checkbox' }]} />],
      ]} />
    </div>
  );
}

// =====================================================================
// Reportes
// =====================================================================
const REPORTS = [['ventas', 'Ventas'], ['utilidad', 'Utilidad por producto'], ['inventario', 'Inventario valorizado']];

export function Reports() {
  const { toast } = useApp();
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState('ventas');
  const [range, setRange] = useState({ from: today.slice(0, 8) + '01', to: today });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setData(null); setError('');
    api.get(`/admin/reports/${type}${qs(range)}`).then(setData).catch((e) => setError(e.message));
  }, [type, range]);

  const fmt = (v, t) => (t === 'money' ? bs(v) : t === 'pct' ? `${v ?? 0}%` : v);
  const exp = (format) => download(`/admin/reports/${type}${qs({ ...range, format })}`, `macai-${type}.${format}`).catch((e) => toast(e.message, 'error'));

  return (
    <div>
      <PageHeader title="Reportes">
        <button className="btn-ghost btn-sm" onClick={() => exp('xlsx')}><Icon name="download" className="size-4" /> Excel</button>
        <button className="btn-ghost btn-sm" onClick={() => exp('pdf')}><Icon name="download" className="size-4" /> PDF</button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex gap-1">
          {REPORTS.map(([k, l]) => <button key={k} className={`btn-sm rounded-full ${type === k ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setType(k)}>{l}</button>)}
        </div>
        {type !== 'inventario' && (
          <>
            <Field label="Desde"><input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
            <Field label="Hasta"><input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
          </>
        )}
      </div>
      <FormError error={error} />
      {!data ? !error && <Loading /> : (
        <div className="card overflow-x-auto">
          <div className="p-4 pb-0"><h2 className="text-2xl font-bold">{data.title}</h2><p className="text-sm text-ink-500">{data.subtitle}</p></div>
          {data.rows.length === 0 ? <Empty title="Sin datos en este período" /> : (
            <table className="table-base mt-3">
              <thead><tr>{data.columns.map(([k, l, t]) => <th key={k} className={t === 'text' ? '' : 'text-right'}>{l}</th>)}</tr></thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i}>{data.columns.map(([k, , t]) => <td key={k} className={t === 'text' ? '' : 'text-right tabular-nums'}>{fmt(r[k], t)}</td>)}</tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">{data.columns.map(([k, , t], i) => <td key={k} className={`px-3 py-3 ${t === 'text' ? '' : 'text-right tabular-nums'}`}>{i === 0 ? 'TOTAL' : data.totals[k] !== undefined ? fmt(data.totals[k], t) : ''}</td>)}</tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Usuarios y permisos
// =====================================================================
const MODULE_LABELS = { dashboard: 'Dashboard', productos: 'Productos', compatibilidad: 'Compatibilidad', inventario: 'Inventario', pedidos: 'Pedidos', clientes: 'Clientes', proveedores: 'Proveedores y compras', promociones: 'Promociones', reportes: 'Reportes', usuarios: 'Usuarios', configuracion: 'Configuración' };

export function Users() {
  const { toast, user: me } = useApp();
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const load = () => api.get('/admin/users').then(setData);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setErrors({}); setError('');
    try {
      if (edit.id) await api.put(`/admin/users/${edit.id}`, edit); else await api.post('/admin/users', edit);
      toast('Usuario guardado'); setEdit(null); load();
    } catch (err) { setErrors(err.details); setError(err.message); }
  };
  const toggle = (m) => setEdit({ ...edit, permissions: edit.permissions.includes(m) ? edit.permissions.filter((x) => x !== m) : [...edit.permissions, m] });
  const f = (k) => ({ value: edit?.[k] ?? '', error: errors[k], onChange: (e) => setEdit({ ...edit, [k]: e.target.value }) });

  if (!data) return <Loading />;
  return (
    <div>
      <PageHeader title="Usuarios y permisos">
        <button className="btn-primary btn-sm" onClick={() => { setErrors({}); setError(''); setEdit({ name: '', email: '', password: '', role: 'empleado', permissions: ['dashboard'], active: true }); }}>
          <Icon name="plus" className="size-4" /> Nuevo empleado
        </button>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Usuario</th><th>Rol</th><th>Módulos</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b><div className="text-xs text-ink-400">{u.email}</div></td>
                <td><Badge color={u.role === 'admin' ? 'brand' : 'gray'}>{u.role === 'admin' ? 'Administrador' : 'Empleado'}</Badge></td>
                <td className="max-w-md text-xs">{u.role === 'admin' ? 'Acceso total' : u.permissions.map((p) => MODULE_LABELS[p]).join(', ') || '—'}</td>
                <td>{u.active ? <Badge color="green">Activo</Badge> : <Badge color="red">Inactivo</Badge>}</td>
                <td><button className="rounded p-1.5 hover:bg-ink-100 dark:hover:bg-ink-800" onClick={() => { setErrors({}); setError(''); setEdit({ ...u, password: '' }); }} aria-label="Editar"><Icon name="edit" className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar usuario' : 'Nuevo empleado'}>
        {edit && (
          <form onSubmit={save} className="space-y-3" noValidate>
            <FormError error={error} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre" error={errors.name}><Input {...f('name')} /></Field>
              <Field label="Correo" error={errors.email}><Input type="email" {...f('email')} /></Field>
              <Field label={edit.id ? 'Nueva contraseña (opcional)' : 'Contraseña'} error={errors.password} hint="Mínimo 8 caracteres"><Input type="password" autoComplete="new-password" {...f('password')} /></Field>
              <Field label="Rol" error={errors.role}>
                <Select {...f('role')} disabled={me.role !== 'admin'}><option value="empleado">Empleado</option><option value="admin">Administrador</option></Select>
              </Field>
            </div>
            {edit.role === 'empleado' && (
              <fieldset>
                <legend className="label">Módulos que puede ver</legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {data.modules.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={edit.permissions.includes(m)} onChange={() => toggle(m)} /> {MODULE_LABELS[m]}</label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Usuario activo</label>
            <button className="btn-primary w-full">Guardar</button>
          </form>
        )}
      </Modal>
    </div>
  );
}

// =====================================================================
// Configuración
// =====================================================================
function SettingsForm({ settingKey, title, fields, settings, onSaved }) {
  const { toast } = useApp();
  const [form, setForm] = useState(settings[settingKey]);
  const [errors, setErrors] = useState({});
  const save = async (e) => {
    e.preventDefault(); setErrors({});
    try { onSaved(await api.put(`/admin/settings/${settingKey}`, form)); toast('Configuración guardada'); }
    catch (err) { setErrors(err.details); toast(err.message, 'error'); }
  };
  return (
    <form onSubmit={save} className="card space-y-3 p-5" noValidate>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, l, type, hint]) => (
          type === 'checkbox'
            ? <label key={k} className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="accent-brand-600" checked={!!form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} /> {l}</label>
            : <Field key={k} label={l} error={errors[k]} hint={hint} className={type === 'wide' ? 'sm:col-span-2' : ''}>
              <Input type={type === 'number' ? 'number' : 'text'} step="any" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </Field>
        ))}
      </div>
      <button className="btn-primary">Guardar</button>
    </form>
  );
}

export function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get('/admin/settings').then(setS); }, []);
  if (!s) return <Loading />;
  return (
    <div>
      <PageHeader title="Configuración" />
      <Tabs tabs={[
        ['tienda', 'Tienda e impuestos', (
          <div key="t" className="grid gap-4 xl:grid-cols-2">
            <SettingsForm settingKey="store" title="Datos de la tienda" settings={s} onSaved={setS} fields={[
              ['name', 'Nombre comercial'], ['legal_name', 'Razón social'], ['rif', 'RIF'], ['phone', 'Teléfono'], ['email', 'Correo'],
              ['whatsapp', 'WhatsApp', 'text', 'Formato internacional: 584141234567'], ['instagram', 'Instagram'], ['address', 'Dirección', 'wide'], ['hours', 'Horario', 'wide']]} />
            <div className="space-y-4">
              <SettingsForm settingKey="tax" title="Impuestos" settings={s} onSaved={setS} fields={[['name', 'Nombre'], ['rate', 'Tasa (%)', 'number', 'Precios del catálogo sin IVA; se suma al pagar']]} />
              <SettingsForm settingKey="customer_discounts" title="Descuento general por tipo de cliente" settings={s} onSaved={setS}
                fields={[['taller', 'Taller (%)', 'number', 'Si el producto no tiene precio taller'], ['mayorista', 'Mayorista (%)', 'number', 'Si no tiene precio mayorista']]} />
              <SettingsForm settingKey="pickup" title="Retiro en tienda" settings={s} onSaved={setS} fields={[['enabled', 'Permitir retiro en tienda', 'checkbox'], ['address', 'Indicaciones', 'wide']]} />
            </div>
          </div>
        )],
        ['pagos', 'Métodos de pago', <CrudPage key="p" title="Métodos de pago" singular="método de pago" endpoint="/admin/settings/payment-methods" defaults={{ active: true, requires_reference: false }}
          columns={[{ key: 'name', label: 'Nombre', render: (r) => <b>{r.name}</b> }, { key: 'code', label: 'Código' }, { key: 'requires_reference', label: 'Pide referencia', render: (r) => yesNo(r.requires_reference) }, { key: 'active', label: 'Activo', render: (r) => yesNo(r.active) }]}
          fields={[{ key: 'name', label: 'Nombre' }, { key: 'code', label: 'Código interno', hint: 'ej. pago_movil' }, { key: 'instructions', label: 'Instrucciones para el cliente', type: 'textarea' },
            { key: 'sort_order', label: 'Orden', type: 'number' }, { key: 'requires_reference', label: 'Pedir número de referencia', type: 'checkbox' }, { key: 'active', label: 'Activo', type: 'checkbox' }]} />],
        ['envios', 'Zonas de envío', <CrudPage key="z" title="Zonas y costos de envío" singular="zona" endpoint="/admin/settings/shipping-zones" defaults={{ active: true }}
          columns={[{ key: 'name', label: 'Zona', render: (r) => <b>{r.name}</b> }, { key: 'states', label: 'Estados', render: (r) => <span className="text-xs">{r.states.join(', ')}</span> },
            { key: 'cost', label: 'Costo', render: (r) => bs(r.cost) }, { key: 'free_from', label: 'Gratis desde', render: (r) => (r.free_from ? bs(r.free_from) : '—') }, { key: 'est_days', label: 'Tiempo' }]}
          fields={[{ key: 'name', label: 'Nombre', span: 2 }, { key: 'states', label: 'Estados que cubre', type: 'tags', span: 2, hint: 'Separados por coma, igual a como aparecen en el checkout' },
            { key: 'cost', label: 'Costo (Bs.)', type: 'number' }, { key: 'free_from', label: 'Envío gratis desde (Bs.)', type: 'number' }, { key: 'est_days', label: 'Tiempo estimado' }, { key: 'active', label: 'Activa', type: 'checkbox' }]} />],
        ['catalogo', 'Categorías y marcas', (
          <div key="c" className="grid gap-6 xl:grid-cols-2">
            <CrudPage title="Categorías" singular="categoría" endpoint="/admin/settings/categories"
              columns={[{ key: 'name', label: 'Nombre', render: (r) => <span className="flex items-center gap-2"><Icon name={r.icon} className="size-4 text-brand-600" /> {r.name}</span> }, { key: 'sort_order', label: 'Orden' }]}
              fields={[{ key: 'name', label: 'Nombre' }, { key: 'icon', label: 'Ícono', type: 'select', options: ['engine', 'brake', 'suspension', 'bolt', 'filter', 'oil', 'car', 'light', 'gear', 'star', 'box'].map((i) => [i, i]) },
                { key: 'sort_order', label: 'Orden', type: 'number' }, { key: 'description', label: 'Descripción', type: 'textarea' }]} />
            <CrudPage title="Marcas de repuestos" singular="marca" endpoint="/admin/settings/brands" columns={[{ key: 'name', label: 'Nombre' }]} fields={[{ key: 'name', label: 'Nombre', span: 2 }]} />
          </div>
        )],
      ]} />
    </div>
  );
}
