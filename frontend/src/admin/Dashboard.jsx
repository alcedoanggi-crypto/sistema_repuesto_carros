// Dashboard: ventas del día/semana/mes, pedidos por estado, stock bajo, más vendidos y gráficos
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { bs, bsShort, dateTime } from '../lib/format.js';
import { StatusBadge } from '../pages/account/Account.jsx';
import { Loading, Stat } from '../components/ui.jsx';
import { PageHeader } from './AdminLayout.jsx';

const BRAND = '#ea580c';

/** Tooltip de los gráficos con tokens de texto (no el color de la serie) */
function ChartTip({ active, payload, label, title }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-ink-700 dark:bg-ink-900">
      <div className="text-ink-500">{label}</div>
      <div className="font-semibold text-ink-900 dark:text-white">{title}: {bs(payload[0].value)}</div>
    </div>
  );
}

function TrendChart({ data, dataKey, title, dark }) {
  const axis = { stroke: dark ? '#65655f' : '#8a8a85', fontSize: 11, tickLine: false, axisLine: false };
  return (
    // min-w-0: evita que el gráfico ensanche la columna de la cuadrícula en bucle
    <div className="card min-w-0 p-4">
      <h2 className="mb-3 font-sans text-sm font-bold">{title} · últimos 30 días</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.25} /><stop offset="100%" stopColor={BRAND} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={dark ? '#262624' : '#ececea'} />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...axis} width={84} tickFormatter={bsShort} />
            <Tooltip content={<ChartTip title={title} />} cursor={{ stroke: dark ? '#4a4a45' : '#b5b5b0' }} />
            <Area type="monotone" dataKey={dataKey} stroke={BRAND} strokeWidth={2} fill={`url(#g-${dataKey})`} activeDot={{ r: 4, strokeWidth: 2, stroke: dark ? '#121211' : '#fff' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { dark } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/admin/dashboard').then(setD); }, []);
  if (!d) return <Loading />;

  const s = d.sales;
  const change = s.prev_month ? ((s.month - s.prev_month) / s.prev_month) * 100 : null;
  const daily = d.daily.map((x) => ({ ...x, label: new Date(`${x.day}T12:00:00`).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) }));
  const pendingTotal = d.pending.pendiente + d.pending.pagado + d.pending.preparacion;

  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ventas de hoy" value={bsShort(s.today)} hint={`${s.today_orders} pedidos`} icon="receipt" tone="brand" />
        <Stat label="Esta semana" value={bsShort(s.week)} icon="chart" />
        <Stat label="Este mes" value={bsShort(s.month)} icon="chart"
          hint={change === null ? `${s.month_orders} pedidos` : `${s.month_orders} pedidos · ${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(0)}% vs. mes anterior`} />
        <Stat label="Por atender" value={pendingTotal} icon="clipboard"
          hint={`${d.pending.pendiente} por pagar · ${d.pending.pagado} pagados · ${d.pending.preparacion} en preparación`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TrendChart data={daily} dataKey="revenue" title="Ingresos" dark={dark} />
        <TrendChart data={daily} dataKey="profit" title="Utilidad bruta" dark={dark} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card min-w-0 p-4">
          <h2 className="mb-3 font-sans text-sm font-bold">Ventas por categoría · 30 días</h2>
          <div style={{ height: Math.max(d.by_category.length * 34, 120) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.by_category} layout="vertical" margin={{ left: 0, right: 12 }} barCategoryGap={6}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} fontSize={11} stroke={dark ? '#b5b5b0' : '#4a4a45'} />
                <Tooltip content={<ChartTip title="Ventas" />} cursor={{ fill: dark ? '#1f1f1c' : '#f6f6f4' }} />
                <Bar dataKey="revenue" fill={BRAND} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-sans text-sm font-bold">Más vendidos · 30 días</h2>
          <ol className="space-y-2.5">
            {d.top_products.map((p, i) => (
              <li key={p.product_id} className="flex items-center gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-100 text-xs font-bold dark:bg-ink-800">{i + 1}</span>
                <span className="flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-ink-500">{p.qty} u · {bsShort(p.revenue)}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-sans text-sm font-bold">Stock bajo</h2>
            <Link to="/admin/inventario?tab=bajo" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">Ver todo</Link>
          </div>
          {d.low_stock.length === 0 ? <p className="text-sm text-ink-500">Todo el inventario está sobre el mínimo.</p> : (
            <ul className="space-y-2">
              {d.low_stock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link to={`/admin/productos/${p.id}`} className="truncate hover:underline">{p.name}</Link>
                  <span className={`shrink-0 rounded px-1.5 text-xs font-bold ${p.stock === 0 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'}`}>
                    {p.stock} / mín {p.min_stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <div className="flex items-center justify-between p-4 pb-0">
          <h2 className="font-sans text-sm font-bold">Pedidos recientes</h2>
          <Link to="/admin/pedidos" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">Ver pedidos</Link>
        </div>
        <table className="table-base mt-2">
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {d.recent_orders.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/admin/pedidos/${o.id}`} className="font-semibold hover:underline">{o.code}</Link></td>
                <td>{o.customer_name}</td><td className="text-ink-500">{dateTime(o.created_at)}</td>
                <td><StatusBadge status={o.status} /></td><td className="text-right font-semibold">{bs(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
