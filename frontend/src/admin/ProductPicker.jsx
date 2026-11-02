// Buscador de productos para formularios del panel (inventario, órdenes de compra)
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function ProductPicker({ value, onChange, error, placeholder = 'Busca por nombre, SKU u OEM' }) {
  const [q, setQ] = useState(value?.name || '');
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);

  // Solo se reescribe el texto al elegir un producto (no al borrar mientras se escribe)
  useEffect(() => { if (value) setQ(`${value.sku} · ${value.name}`); }, [value]);
  useEffect(() => {
    if (!open || q.length < 2) return setList([]);
    const t = setTimeout(() => api.get(`/admin/products?limit=8&q=${encodeURIComponent(q)}`).then((r) => setList(r.items)), 200);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <div className="relative">
      <input className={`input ${error ? 'input-error' : ''}`} value={q} placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); if (value) onChange(null); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} aria-label="Producto" />
      {open && list.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-900">
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-ink-100 dark:hover:bg-ink-800"
                onMouseDown={() => { onChange(p); setOpen(false); }}>
                <span className="truncate"><b>{p.sku}</b> · {p.name}</span><span className="shrink-0 text-xs text-ink-400">Stock {p.stock}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </div>
  );
}
