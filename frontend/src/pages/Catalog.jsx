// Catálogo: búsqueda por texto/OEM, categoría, compatibilidad con vehículo y filtros.
// Todos los filtros viven en la URL para poder compartir o guardar la búsqueda.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, qs } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { bs, vehicleLabel } from '../lib/format.js';
import ProductCard from '../components/ProductCard.jsx';
import Icon from '../components/Icon.jsx';
import Seo from '../components/Seo.jsx';
import { Empty, Loading, Pagination } from '../components/ui.jsx';

const SORTS = [['relevance', 'Relevancia'], ['best_sellers', 'Más vendidos'], ['price_asc', 'Menor precio'], ['price_desc', 'Mayor precio'], ['newest', 'Más recientes']];

function Filters({ params, set, facets }) {
  const [min, setMin] = useState(params.get('min_price') || '');
  const [max, setMax] = useState(params.get('max_price') || '');
  const brands = (params.get('brand') || '').split(',').filter(Boolean);
  const toggleBrand = (id) => {
    const next = brands.includes(String(id)) ? brands.filter((b) => b !== String(id)) : [...brands, String(id)];
    set({ brand: next.join(',') });
  };
  const box = 'border-b border-ink-200 pb-4 dark:border-ink-800';
  return (
    <div className="space-y-4">
      <div className={box}>
        <h3 className="mb-2 font-sans text-sm font-bold">Disponibilidad</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-600" checked={params.get('in_stock') === '1'} onChange={(e) => set({ in_stock: e.target.checked ? '1' : '' })} />
          Solo con stock
        </label>
      </div>
      <div className={box}>
        <h3 className="mb-2 font-sans text-sm font-bold">Tipo de repuesto</h3>
        {[['', 'Todos'], ['original', 'Original (OEM)'], ['generico', 'Genérico / alternativo']].map(([v, l]) => (
          <label key={v} className="flex items-center gap-2 py-0.5 text-sm">
            <input type="radio" name="original" className="accent-brand-600" checked={(params.get('original') || '') === v} onChange={() => set({ original: v })} />
            {l}
          </label>
        ))}
      </div>
      <div className={box}>
        <h3 className="mb-2 font-sans text-sm font-bold">Precio (Bs.)</h3>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); set({ min_price: min, max_price: max }); }}>
          <input className="input py-1.5" inputMode="numeric" placeholder="Mín." value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} aria-label="Precio mínimo" />
          <span className="text-ink-400">–</span>
          <input className="input py-1.5" inputMode="numeric" placeholder="Máx." value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} aria-label="Precio máximo" />
          <button className="btn-dark btn-sm" aria-label="Aplicar precio"><Icon name="chevronRight" className="size-4" /></button>
        </form>
      </div>
      {facets?.brands?.length > 0 && (
        <div>
          <h3 className="mb-2 font-sans text-sm font-bold">Marca del repuesto</h3>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {facets.brands.map((b) => (
              <label key={b.id} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" className="accent-brand-600" checked={brands.includes(String(b.id))} onChange={() => toggleBrand(b.id)} />
                <span className="flex-1">{b.name}</span><span className="text-xs text-ink-400">{b.count}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Catalog() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { vehicle } = useApp();
  const [data, setData] = useState(null);
  const [category, setCategory] = useState(null);
  const [urlVehicle, setUrlVehicle] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [makes, setMakes] = useState([]);

  const vehicleId = params.get('vehicle_id');
  const query = useMemo(() => ({ ...Object.fromEntries(params), category: slug || params.get('category') || '' }), [params, slug]);

  useEffect(() => {
    setData(null);
    api.get(`/products${qs(query)}`).then(setData).catch(() => setData({ items: [], total: 0 }));
  }, [query]);

  useEffect(() => {
    if (!slug) return setCategory(null);
    api.get('/categories').then((list) => setCategory(list.find((c) => c.slug === slug) || null));
  }, [slug]);

  // Si el vehículo viene en la URL, se carga su descripción (puede no ser el guardado)
  useEffect(() => {
    if (!vehicleId) return setUrlVehicle(null);
    if (vehicle?.id === Number(vehicleId)) return setUrlVehicle(vehicle);
    api.get(`/vehicles/${vehicleId}`).then(setUrlVehicle).catch(() => setUrlVehicle(null));
  }, [vehicleId, vehicle]);

  useEffect(() => { if (params.get('make_id')) api.get('/vehicles/makes').then(setMakes); }, [params]);

  /** Actualiza filtros en la URL y vuelve a la página 1 */
  const set = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
    setDrawer(false);
  };

  const q = params.get('q');
  const make = makes.find((m) => String(m.id) === params.get('make_id'));
  const title = q ? `Resultados para “${q}”` : category ? category.name : make ? `Repuestos para ${make.name}` : urlVehicle ? 'Repuestos compatibles' : 'Catálogo de repuestos';
  const items = (data?.items || []).map((p) => ({ ...p, fits_vehicle: !!vehicleId }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Seo title={title} description={category?.description || `Compra ${title.toLowerCase()} en MACAI Autopartes. Envíos a toda Venezuela.`}
        noindex={!!q || !!vehicleId} />
      <nav className="mb-2 text-xs text-ink-400" aria-label="Ruta"><Link to="/" className="hover:underline">Inicio</Link> / <span>{title}</span></nav>
      <h1 className="text-4xl font-extrabold uppercase">{title}</h1>
      {category?.description && <p className="mt-1 text-sm text-ink-500">{category.description}</p>}

      {/* Aviso de compatibilidad */}
      {urlVehicle ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-500/30 dark:bg-green-500/10">
          <Icon name="check" className="size-5 text-green-700 dark:text-green-400" />
          <span>Mostrando solo repuestos compatibles con <b>{vehicleLabel(urlVehicle)}</b></span>
          <button onClick={() => set({ vehicle_id: '' })} className="ml-auto text-xs font-semibold text-ink-600 underline dark:text-ink-300">Ver todos</button>
        </div>
      ) : vehicle ? (
        <button onClick={() => set({ vehicle_id: vehicle.id })}
          className="mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-ink-300 px-4 py-3 text-left text-sm hover:border-brand-500 dark:border-ink-700">
          <Icon name="car" className="size-5 text-brand-600" />
          <span>Filtrar por mi vehículo: <b>{vehicleLabel(vehicle)}</b></span>
        </button>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block"><Filters key={params.toString()} params={params} set={set} facets={data?.facets} /></aside>
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-500">{data ? `${data.total} productos` : 'Buscando...'}</p>
            <div className="flex items-center gap-2">
              <button className="btn-ghost btn-sm lg:hidden" onClick={() => setDrawer(true)}><Icon name="sliders" className="size-4" /> Filtros</button>
              <select className="input w-auto py-1.5" value={params.get('sort') || 'relevance'} onChange={(e) => set({ sort: e.target.value })} aria-label="Ordenar por">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          {(params.get('min_price') || params.get('max_price')) && (
            <p className="mb-3 text-xs text-ink-500">
              Precio: {params.get('min_price') ? bs(params.get('min_price')) : 'Bs. 0'} – {params.get('max_price') ? bs(params.get('max_price')) : 'sin límite'}{' '}
              <button className="underline" onClick={() => set({ min_price: '', max_price: '' })}>quitar</button>
            </p>
          )}
          {!data ? <Loading /> : items.length === 0 ? (
            <Empty icon="search" title="No encontramos repuestos" action={<Link to="/catalogo" className="btn-ghost">Ver todo el catálogo</Link>}>
              Prueba con otro término, revisa el número de parte o quita algunos filtros. También puedes escribirnos por WhatsApp y te ayudamos a ubicarlo.
            </Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {items.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              <Pagination page={data.page} pages={data.pages} onChange={(page) => { set({ page: String(page) }); window.scrollTo(0, 0); }} />
            </>
          )}
        </div>
      </div>

      {/* Filtros en móvil */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-5 dark:bg-ink-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Filtros</h2>
              <button onClick={() => setDrawer(false)} aria-label="Cerrar"><Icon name="x" /></button>
            </div>
            <Filters params={params} set={set} facets={data?.facets} />
          </div>
        </div>
      )}
    </div>
  );
}
