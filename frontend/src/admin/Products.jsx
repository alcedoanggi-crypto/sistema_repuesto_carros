// Panel → Productos: listado con filtros, importar/exportar Excel o CSV, y formulario completo
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, download, qs } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { bs } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import PartImage from '../components/PartImage.jsx';
import { Badge, Field, FormError, Input, Loading, Modal, Pagination, Select, Textarea } from '../components/ui.jsx';
import { PageHeader } from './AdminLayout.jsx';

export function ProductList() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const filters = Object.fromEntries(params);
  const load = () => api.get(`/admin/products${qs(filters)}`).then(setData);
  useEffect(() => { load(); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get('/categories').then(setCategories); }, []);

  const set = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); };

  const doImport = async (file) => {
    if (!file) return;
    setImporting(true); setResult(null);
    const fd = new FormData(); fd.append('file', file);
    try { setResult(await api.upload('/admin/products/import', fd)); load(); } catch (e) { toast(e.message, 'error'); } finally { setImporting(false); fileRef.current.value = ''; }
  };

  return (
    <div>
      <PageHeader title="Productos">
        <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => doImport(e.target.files[0])} />
        <button className="btn-ghost btn-sm" disabled={importing} onClick={() => fileRef.current.click()}><Icon name="upload" className="size-4" /> {importing ? 'Importando...' : 'Importar'}</button>
        <button className="btn-ghost btn-sm" onClick={() => download('/admin/products/export', 'productos-macai.xlsx').catch((e) => toast(e.message, 'error'))}><Icon name="download" className="size-4" /> Excel</button>
        <button className="btn-ghost btn-sm" onClick={() => download('/admin/products/export?format=csv', 'productos-macai.csv').catch((e) => toast(e.message, 'error'))}><Icon name="download" className="size-4" /> CSV</button>
        <Link to="/admin/productos/nuevo" className="btn-primary btn-sm"><Icon name="plus" className="size-4" /> Nuevo producto</Link>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Buscar nombre, SKU u OEM" defaultValue={params.get('q') || ''}
          onKeyDown={(e) => e.key === 'Enter' && set('q', e.target.value)} aria-label="Buscar" />
        <select className="input w-auto" value={params.get('category') || ''} onChange={(e) => set('category', e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>{categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={params.get('low_stock') === '1'} onChange={(e) => set('low_stock', e.target.checked ? '1' : '')} /> Solo stock bajo</label>
      </div>

      {!data ? <Loading /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Producto</th><th>SKU / OEM</th><th>Categoría</th><th className="text-right">Costo</th><th className="text-right">Venta</th><th className="text-right">Stock</th><th>Ubicación</th><th>Estado</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/admin/productos/${p.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                        <span className="size-10 shrink-0 overflow-hidden rounded"><PartImage product={p} /></span>
                        <span className="line-clamp-2 max-w-xs">{p.name}</span>
                      </Link>
                    </td>
                    <td className="text-xs"><b>{p.sku}</b><div className="text-ink-400">{p.oem_number || '—'}</div></td>
                    <td>{p.category_name}</td>
                    <td className="text-right text-ink-500">{bs(p.cost_price)}</td>
                    <td className="text-right font-semibold">{bs(p.price)}</td>
                    <td className="text-right">
                      <span className={p.stock <= p.min_stock ? 'font-bold text-red-600' : ''}>{p.stock}</span>
                      <span className="text-xs text-ink-400"> / {p.min_stock}</span>
                    </td>
                    <td className="text-xs">{p.warehouse_location || '—'}</td>
                    <td>{p.active ? <Badge color="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-500">{data.total} productos</p>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => set('page', String(p))} />
        </>
      )}

      <Modal open={!!result} onClose={() => setResult(null)} title="Resultado de la importación">
        {result && (
          <div className="space-y-3 text-sm">
            <p><b>{result.created}</b> productos creados · <b>{result.updated}</b> actualizados · <b className={result.errors.length ? 'text-red-600' : ''}>{result.errors.length}</b> con errores</p>
            {result.errors.length > 0 && (
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {result.errors.map((e) => <li key={e.row}>Fila {e.row} ({e.sku}): {e.error}</li>)}
              </ul>
            )}
            <p className="text-xs text-ink-500">Formato: usa las mismas columnas del archivo exportado. La compatibilidad se escribe como <code>Marca/Modelo/2009-2013/Motor</code>, separando vehículos con punto y coma (el motor es opcional).</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

const EMPTY = {
  name: '', sku: '', oem_number: '', manufacturer_code: '', category_id: '', brand_id: '', is_original: false, description: '',
  cost_price: '', price: '', price_workshop: '', price_wholesale: '', stock: 0, min_stock: 2, warehouse_location: '',
  warranty_months: 3, images: [], featured: false, active: true,
};

/** Selector para agregar compatibilidad por rango: Marca → Modelo → Años → Motor */
function CompatEditor({ list, onChange }) {
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [engines, setEngines] = useState([]);
  const [f, setF] = useState({ make_id: '', model_id: '', year_from: '', year_to: '', engine: '' });
  const [years, setYears] = useState([]);

  useEffect(() => { api.get('/vehicles/makes').then(setMakes); }, []);
  useEffect(() => { setModels([]); if (f.make_id) api.get(`/vehicles/models?make_id=${f.make_id}`).then(setModels); }, [f.make_id]);
  useEffect(() => {
    setYears([]); setEngines([]);
    if (!f.model_id) return;
    api.get(`/vehicles/years?model_id=${f.model_id}`).then((ys) => { setYears(ys); setF((x) => ({ ...x, year_from: Math.min(...ys), year_to: Math.max(...ys) })); });
    api.get(`/admin/compat/vehicles?model_id=${f.model_id}`).then((vs) => setEngines([...new Set(vs.map((v) => v.engine))]));
  }, [f.model_id]);

  const add = async () => {
    const found = await api.get(`/admin/compat/search${qs({ model_id: f.model_id, year_from: f.year_from, year_to: f.year_to, engine: f.engine })}`);
    const ids = new Set(list.map((x) => x.vehicle_id));
    onChange([...list, ...found.filter((v) => !ids.has(v.vehicle_id))]);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <select className="input" value={f.make_id} onChange={(e) => setF({ make_id: e.target.value, model_id: '', year_from: '', year_to: '', engine: '' })} aria-label="Marca">
          <option value="">Marca</option>{makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="input" value={f.model_id} disabled={!f.make_id} onChange={(e) => setF({ ...f, model_id: e.target.value, engine: '' })} aria-label="Modelo">
          <option value="">Modelo</option>{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="input" value={f.year_from} disabled={!years.length} onChange={(e) => setF({ ...f, year_from: e.target.value })} aria-label="Desde">
          {[...years].reverse().map((y) => <option key={y} value={y}>Desde {y}</option>)}
        </select>
        <select className="input" value={f.year_to} disabled={!years.length} onChange={(e) => setF({ ...f, year_to: e.target.value })} aria-label="Hasta">
          {years.map((y) => <option key={y} value={y}>Hasta {y}</option>)}
        </select>
        <select className="input" value={f.engine} disabled={!engines.length} onChange={(e) => setF({ ...f, engine: e.target.value })} aria-label="Motor">
          <option value="">Todos los motores</option>{engines.map((e) => <option key={e}>{e}</option>)}
        </select>
        <button type="button" className="btn-dark" disabled={!f.model_id} onClick={add}><Icon name="plus" className="size-4" /> Agregar</button>
      </div>
      <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-ink-200 dark:border-ink-800">
        {list.length === 0 ? <p className="p-3 text-sm text-ink-500">Sin vehículos: el producto se mostrará como de uso universal.</p> : (
          <table className="table-base">
            <tbody>
              {list.map((v) => (
                <tr key={v.vehicle_id}>
                  <td>{v.make} {v.model}</td><td>{v.year}</td><td className="text-xs">{v.engine}</td>
                  <td className="w-10"><button type="button" className="p-1 text-red-600" onClick={() => onChange(list.filter((x) => x.vehicle_id !== v.vehicle_id))} aria-label="Quitar"><Icon name="x" className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {list.length > 0 && <p className="mt-1 text-xs text-ink-500">{list.length} combinaciones de vehículo</p>}
    </div>
  );
}

export function ProductForm() {
  const { id } = useParams();
  const isNew = id === 'nuevo';
  const navigate = useNavigate();
  const { toast } = useApp();
  const [form, setForm] = useState(isNew ? EMPTY : null);
  const [compat, setCompat] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/categories').then(setCategories);
    api.get('/brands').then(setBrands);
    if (!isNew) api.get(`/admin/products/${id}`).then((p) => { setForm(p); setCompat(p.compatibility); });
  }, [id, isNew]);

  if (!form) return <Loading />;

  const f = (k) => ({ value: form[k] ?? '', error: errors[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  const margin = form.price && form.cost_price ? ((form.price - form.cost_price) / form.price) * 100 : null;

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const fd = new FormData();
    [...files].forEach((file) => fd.append('images', file));
    try { const urls = await api.upload('/admin/products/images', fd); setForm((x) => ({ ...x, images: [...(x.images || []), ...urls] })); }
    catch (e) { toast(e.message, 'error'); } finally { setUploading(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErrors({}); setError('');
    try {
      let pid = form.id;
      if (isNew) pid = (await api.post('/admin/products', form)).id; else await api.put(`/admin/products/${pid}`, form);
      await api.put(`/admin/products/${pid}/compatibility`, { vehicles: compat.map((c) => ({ vehicle_id: c.vehicle_id, note: c.note })) });
      toast('Producto guardado');
      navigate('/admin/productos');
    } catch (err) { setErrors(err.details); setError(err.message); window.scrollTo(0, 0); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    try {
      const r = await api.del(`/admin/products/${form.id}`);
      toast(r?.message || 'Producto eliminado');
      navigate('/admin/productos');
    } catch (e) { toast(e.message, 'error'); }
  };

  const section = 'card p-5 space-y-3';
  return (
    <form onSubmit={save} noValidate>
      <PageHeader title={isNew ? 'Nuevo producto' : 'Editar producto'}>
        {!isNew && <a href={`/producto/${form.slug}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><Icon name="eye" className="size-4" /> Ver en tienda</a>}
        {!isNew && <button type="button" className="btn-ghost btn-sm text-red-600!" onClick={remove}><Icon name="trash" className="size-4" /> Eliminar</button>}
        <button className="btn-primary btn-sm" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
      </PageHeader>
      <FormError error={error} />
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className={section}>
            <h2 className="text-xl font-bold">Información</h2>
            <Field label="Nombre" error={errors.name}><Input {...f('name')} /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="SKU" error={errors.sku}><Input {...f('sku')} className="uppercase" /></Field>
              <Field label="Número OEM"><Input {...f('oem_number')} /></Field>
              <Field label="Código del fabricante"><Input {...f('manufacturer_code')} /></Field>
              <Field label="Categoría" error={errors.category_id}>
                <Select {...f('category_id')}><option value="">Selecciona</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              </Field>
              <Field label="Marca del repuesto">
                <Select {...f('brand_id')}><option value="">Sin marca</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
              </Field>
              <Field label="Garantía (meses)" error={errors.warranty_months}><Input type="number" min="0" {...f('warranty_months')} /></Field>
            </div>
            <Field label="Descripción"><Textarea rows={4} {...f('description')} /></Field>
            <div className="flex flex-wrap gap-5 text-sm">
              {[['is_original', 'Repuesto original (OEM)'], ['featured', 'Destacado en inicio'], ['active', 'Visible en la tienda']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand-600" checked={!!form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} /> {l}</label>
              ))}
            </div>
          </div>
          <div className={section}>
            <h2 className="text-xl font-bold">Compatibilidad de vehículos</h2>
            <CompatEditor list={compat} onChange={setCompat} />
          </div>
        </div>

        <div className="space-y-4">
          <div className={section}>
            <h2 className="text-xl font-bold">Precios (Bs., sin IVA)</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Costo" error={errors.cost_price}><Input type="number" step="0.01" min="0" {...f('cost_price')} /></Field>
              <Field label="Venta (normal)" error={errors.price}><Input type="number" step="0.01" min="0" {...f('price')} /></Field>
              <Field label="Precio taller" error={errors.price_workshop} hint="Vacío = % general"><Input type="number" step="0.01" min="0" {...f('price_workshop')} /></Field>
              <Field label="Precio mayorista" error={errors.price_wholesale} hint="Vacío = % general"><Input type="number" step="0.01" min="0" {...f('price_wholesale')} /></Field>
            </div>
            {margin !== null && <p className={`text-sm ${margin < 0 ? 'text-red-600' : 'text-ink-500'}`}>Margen: <b>{margin.toFixed(1)}%</b> · Utilidad {bs(form.price - form.cost_price)}</p>}
          </div>
          <div className={section}>
            <h2 className="text-xl font-bold">Inventario</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label={isNew ? 'Stock inicial' : 'Stock actual'} error={errors.stock} hint={isNew ? '' : 'Se cambia desde Inventario'}>
                <Input type="number" min="0" {...f('stock')} disabled={!isNew} />
              </Field>
              <Field label="Stock mínimo" error={errors.min_stock}><Input type="number" min="0" {...f('min_stock')} /></Field>
              <Field label="Ubicación en bodega" className="col-span-2" hint="Pasillo-Estante-Nivel, ej. A-01-2"><Input {...f('warehouse_location')} /></Field>
            </div>
          </div>
          <div className={section}>
            <h2 className="text-xl font-bold">Fotos</h2>
            <div className="grid grid-cols-3 gap-2">
              {(form.images || []).map((src, i) => (
                <div key={src} className="group relative aspect-square overflow-hidden rounded-lg border border-ink-200 dark:border-ink-700">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute top-1 left-1 rounded bg-ink-900/80 px-1 text-[10px] text-white">Principal</span>}
                  <button type="button" onClick={() => setForm({ ...form, images: form.images.filter((x) => x !== src) })}
                    className="absolute top-1 right-1 rounded bg-white/90 p-0.5 text-red-600" aria-label="Quitar foto"><Icon name="x" className="size-4" /></button>
                </div>
              ))}
              <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border-2 border-dashed border-ink-300 text-center text-xs text-ink-500 hover:border-brand-500 dark:border-ink-700">
                <span><Icon name="upload" className="mx-auto mb-1" />{uploading ? 'Subiendo...' : 'Subir fotos'}</span>
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files)} />
              </label>
            </div>
            <p className="text-xs text-ink-400">JPG, PNG o WEBP de hasta 3 MB.</p>
          </div>
        </div>
      </div>
    </form>
  );
}
