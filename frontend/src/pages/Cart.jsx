// Carrito: cantidades, cupón y resumen. Los precios siempre vienen cotizados desde el servidor.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { bs } from '../lib/format.js';
import PartImage from '../components/PartImage.jsx';
import Icon from '../components/Icon.jsx';
import Seo from '../components/Seo.jsx';
import { Empty, Loading } from '../components/ui.jsx';

/** Hook de cotización compartido por carrito y checkout */
export function useQuote(extra) {
  const { cart, user } = useApp();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const key = JSON.stringify({ cart: cart.map((i) => [i.product_id, i.quantity]), extra, u: user?.id });
  useEffect(() => {
    if (!cart.length) { setQuote(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      api.post('/cart/quote', { items: cart, ...extra })
        .then((q) => { if (alive) { setQuote(q); setError(''); } })
        .catch((e) => alive && setError(e.message));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { quote, error };
}

export function Totals({ quote, showShipping = false }) {
  if (!quote) return null;
  const row = (l, v, cls = '') => <div className={`flex justify-between py-1 text-sm ${cls}`}><span>{l}</span><span>{v}</span></div>;
  return (
    <div>
      {row('Subtotal', bs(quote.subtotal))}
      {quote.discount > 0 && row(`Cupón ${quote.coupon}`, `- ${bs(quote.discount)}`, 'text-green-700 dark:text-green-400')}
      {row(`${quote.tax_name} (${quote.tax_rate}%)`, bs(quote.tax))}
      {showShipping && row('Envío', quote.delivery_type === 'retiro' ? 'Retiro en tienda (gratis)' : quote.zone ? (quote.shipping_cost ? bs(quote.shipping_cost) : 'Gratis') : 'Selecciona la zona')}
      <div className="mt-2 flex justify-between border-t border-ink-200 pt-3 dark:border-ink-700">
        <span className="font-semibold">Total</span>
        <span className="font-display text-3xl font-extrabold">{bs(quote.total)}</span>
      </div>
    </div>
  );
}

export default function Cart() {
  const { cart, setQty } = useApp();
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState('');
  const { quote, error } = useQuote({ coupon: applied });

  if (!cart.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <Seo title="Carrito" noindex />
        <Empty icon="cart" title="Tu carrito está vacío" action={<Link to="/catalogo" className="btn-primary">Ver repuestos</Link>}>
          Busca por tu vehículo o por número de parte y agrega los repuestos que necesitas.
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Seo title="Carrito" noindex />
      <h1 className="mb-6 text-4xl font-extrabold uppercase">Carrito</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {!quote ? <Loading /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="card divide-y divide-ink-100 dark:divide-ink-800">
            {quote.lines.map((l) => {
              const problem = quote.problems.find((p) => p.product_id === l.product_id);
              return (
                <div key={l.product_id} className="flex gap-3 p-4">
                  <Link to={`/producto/${l.slug}`} className="size-20 shrink-0 overflow-hidden rounded-lg"><PartImage product={l} /></Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/producto/${l.slug}`} className="line-clamp-2 text-sm font-semibold hover:underline">{l.name}</Link>
                    <p className="text-xs text-ink-400">SKU {l.sku}{l.promo && <span className="ml-2 font-semibold text-brand-700">{l.promo.name}</span>}</p>
                    {problem && <p className="mt-1 text-xs font-semibold text-red-600">{problem.error}</p>}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center rounded-lg border border-ink-200 dark:border-ink-700">
                        <button className="p-1.5" onClick={() => setQty(l.product_id, l.quantity - 1)} aria-label="Restar"><Icon name="minus" className="size-4" /></button>
                        <span className="w-8 text-center text-sm font-semibold">{l.quantity}</span>
                        <button className="p-1.5" disabled={l.quantity >= l.stock} onClick={() => setQty(l.product_id, l.quantity + 1)} aria-label="Sumar"><Icon name="plus" className="size-4" /></button>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-lg font-bold">{bs(l.total)}</div>
                        <div className="text-xs text-ink-400">{bs(l.unit_price)} c/u</div>
                      </div>
                    </div>
                  </div>
                  <button className="self-start p-1 text-ink-400 hover:text-red-600" onClick={() => setQty(l.product_id, 0)} aria-label={`Quitar ${l.name}`}><Icon name="trash" className="size-4" /></button>
                </div>
              );
            })}
          </div>

          <aside className="card h-fit p-5 lg:sticky lg:top-40">
            <h2 className="mb-3 text-2xl font-bold">Resumen</h2>
            <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(coupon.trim()); }}>
              <input className="input uppercase" placeholder="Cupón de descuento" value={coupon} onChange={(e) => setCoupon(e.target.value)} aria-label="Cupón" />
              <button className="btn-dark">Aplicar</button>
            </form>
            {quote.couponError && <p className="mb-2 text-xs font-medium text-red-600">{quote.couponError}</p>}
            {quote.coupon && <p className="mb-2 text-xs font-medium text-green-700 dark:text-green-400">Cupón {quote.coupon} aplicado</p>}
            <Totals quote={quote} />
            <p className="mt-1 text-xs text-ink-400">El envío se calcula en el siguiente paso.</p>
            <button className="btn-primary mt-4 w-full py-3" disabled={quote.problems.length > 0}
              onClick={() => navigate('/checkout', { state: { coupon: quote.coupon || '' } })}>
              Continuar con la compra <Icon name="arrowRight" className="size-4" />
            </button>
            {quote.problems.length > 0 && <p className="mt-2 text-xs text-red-600">Ajusta las cantidades marcadas para continuar.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
