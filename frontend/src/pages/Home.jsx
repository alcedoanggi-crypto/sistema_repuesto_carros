// Página de inicio: hero con buscador por vehículo, promociones, categorías, más vendidos y marcas
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import VehicleSelector from '../components/VehicleSelector.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Icon from '../components/Icon.jsx';
import Seo from '../components/Seo.jsx';
import { Spinner } from '../components/ui.jsx';

/** Cuenta regresiva de una oferta por tiempo limitado */
function Countdown({ to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(new Date(to) - now, 0);
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
  const box = (v, l) => (
    <span className="flex min-w-11 flex-col items-center rounded-md bg-black/25 px-1.5 py-1">
      <b className="font-display text-xl leading-none tabular-nums">{String(v).padStart(2, '0')}</b>
      <span className="text-[10px] uppercase opacity-80">{l}</span>
    </span>
  );
  return <div className="flex gap-1.5" aria-label="Tiempo restante de la oferta">{box(d, 'días')}{box(h, 'hrs')}{box(m, 'min')}{box(s, 'seg')}</div>;
}

export default function Home() {
  const { storeInfo } = useApp();
  const [categories, setCategories] = useState([]);
  const [best, setBest] = useState(null);
  const [featured, setFeatured] = useState(null);
  const [makes, setMakes] = useState([]);

  useEffect(() => {
    api.get('/categories').then(setCategories);
    api.get('/products?sort=best_sellers&limit=8').then((r) => setBest(r.items));
    api.get('/products?featured=1&limit=4&sort=newest').then((r) => setFeatured(r.items));
    api.get('/vehicles/makes').then(setMakes);
  }, []);

  const banners = storeInfo?.banners || [];

  return (
    <>
      <Seo description="Repuestos y autopartes para Toyota, Chevrolet, Ford, Hyundai, Mitsubishi y Kia. Encuentra la pieza exacta por marca, modelo, año y motor. Envíos a toda Venezuela." />

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900 text-white dark:bg-ink-950">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }} />
        <div className="absolute -right-24 -bottom-24 hidden size-[28rem] rounded-full border-[40px] border-brand-600/25 lg:block" />
        <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-24 sm:pt-14">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-600/20 px-3 py-1 text-xs font-semibold tracking-wide text-brand-200 uppercase">
            <Icon name="shield" className="size-4" /> Repuestos con garantía
          </p>
          <h1 className="max-w-3xl text-5xl leading-[0.95] font-extrabold uppercase sm:text-6xl lg:text-7xl">
            La pieza exacta para tu carro, <span className="text-brand-500">sin adivinar.</span>
          </h1>
          <p className="mt-4 max-w-xl text-ink-300">
            Elige marca, modelo, año y motor, y te mostramos solo los repuestos compatibles. Originales y genéricos, con envío a toda Venezuela.
          </p>
        </div>
      </section>
      <div className="relative z-10 mx-auto -mt-16 max-w-7xl px-4">
        <VehicleSelector />
      </div>

      {/* Ventajas */}
      <section className="mx-auto mt-8 grid max-w-7xl grid-cols-2 gap-3 px-4 lg:grid-cols-4">
        {[
          ['truck', 'Envíos nacionales', 'Delivery en Gran Caracas en 24 h y MRW/Zoom al interior'],
          ['store', 'Retiro en tienda', 'Compra en línea y retira en Los Ruices'],
          ['shield', 'Garantía real', 'De 3 a 18 meses según el repuesto'],
          ['users', 'Precios para talleres', 'Tarifas especiales para talleres y mayoristas'],
        ].map(([icon, t, d]) => (
          <div key={t} className="card flex gap-3 p-4">
            <Icon name={icon} className="size-6 shrink-0 text-brand-600" />
            <div><h3 className="font-sans text-sm font-bold">{t}</h3><p className="text-xs text-ink-500">{d}</p></div>
          </div>
        ))}
      </section>

      {/* Promociones */}
      {banners.length > 0 && (
        <section className="mx-auto mt-10 grid max-w-7xl gap-4 px-4 md:grid-cols-2">
          {banners.map((b, i) => (
            <Link key={b.id} to={b.scope === 'category' ? `/categoria/${b.category_slug}` : `/producto/${b.product_slug}`}
              className={`group relative overflow-hidden rounded-2xl p-6 text-white ${i % 2 ? 'bg-ink-800 dark:bg-ink-850' : 'bg-brand-600'}`}>
              <div className="absolute -top-6 -right-6 font-display text-[9rem] leading-none font-extrabold opacity-15">-{Math.round(b.percent)}%</div>
              <p className="text-xs font-semibold tracking-widest uppercase opacity-80">Oferta por tiempo limitado</p>
              <h2 className="mt-1 text-3xl font-extrabold uppercase">{b.name}</h2>
              <p className="mt-1 text-sm opacity-90">{Math.round(b.percent)}% de descuento {b.scope === 'category' ? `en toda la categoría ${b.category_name}` : 'en este producto'}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Countdown to={b.ends_at} />
                <span className="inline-flex items-center gap-1 text-sm font-bold group-hover:underline">Ver oferta <Icon name="arrowRight" className="size-4" /></span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* Categorías */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-3xl font-extrabold uppercase">Categorías</h2>
          <Link to="/catalogo" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">Ver todo el catálogo</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Link key={c.id} to={`/categoria/${c.slug}`} className="card group flex flex-col items-start gap-2 p-4 transition hover:border-brand-500">
              <span className="rounded-lg bg-ink-100 p-2.5 text-ink-700 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-ink-800 dark:text-ink-200">
                <Icon name={c.icon} className="size-6" />
              </span>
              <span className="font-display text-lg leading-tight font-bold">{c.name}</span>
              <span className="text-xs text-ink-400">{c.product_count} productos</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Más vendidos */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-3xl font-extrabold uppercase">Más vendidos</h2>
          <Link to="/catalogo?sort=best_sellers" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">Ver más</Link>
        </div>
        {!best ? <div className="py-10 text-center"><Spinner /></div> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {best.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Marcas de vehículos */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <h2 className="mb-4 text-3xl font-extrabold uppercase">Repuestos por marca de vehículo</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {makes.map((m) => (
            <Link key={m.id} to={`/catalogo?make_id=${m.id}`}
              className="card flex flex-col items-center justify-center gap-1 px-3 py-6 text-center transition hover:border-brand-500 hover:shadow-md">
              <span className="font-display text-2xl font-extrabold tracking-wider uppercase">{m.name}</span>
              <span className="text-xs text-ink-400">{m.model_count} modelos</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Destacados */}
      {featured?.length > 0 && (
        <section className="mx-auto mt-12 max-w-7xl px-4">
          <h2 className="mb-4 text-3xl font-extrabold uppercase">Recomendados del taller</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Talleres */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <div className="relative overflow-hidden rounded-2xl bg-ink-900 p-8 text-white sm:p-10 dark:bg-ink-850">
          <div className="hazard absolute inset-y-0 right-0 hidden w-24 opacity-80 md:block" />
          <h2 className="text-3xl font-extrabold uppercase sm:text-4xl">¿Tienes un taller o vendes repuestos?</h2>
          <p className="mt-2 max-w-xl text-ink-300">Regístrate y solicita tu cuenta de taller o mayorista para acceder a precios diferenciados en todo el catálogo.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/registro" className="btn-primary">Crear cuenta</Link>
            <Link to="/contacto" className="btn border border-white/30 text-white hover:bg-white/10">Hablar con un asesor</Link>
          </div>
        </div>
      </section>
    </>
  );
}
