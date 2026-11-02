// Componentes de interfaz reutilizables: campos con error, modal, badges, paginación, estados vacíos
import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

/** Campo de formulario con etiqueta y mensaje de error */
export function Field({ label, error, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
    </label>
  );
}

export function Input({ error, className = '', ...props }) {
  return <input className={`input ${error ? 'input-error' : ''} ${className}`} aria-invalid={!!error} {...props} />;
}

export function Select({ error, className = '', children, ...props }) {
  return <select className={`input ${error ? 'input-error' : ''} ${className}`} aria-invalid={!!error} {...props}>{children}</select>;
}

export function Textarea({ error, className = '', ...props }) {
  return <textarea className={`input min-h-24 ${error ? 'input-error' : ''} ${className}`} aria-invalid={!!error} {...props} />;
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 rounded accent-brand-600" {...props} />
      <span>{label}</span>
    </label>
  );
}

const BADGE = {
  gray: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  brand: 'bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300',
};
export function Badge({ color = 'gray', children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[color]} ${className}`}>{children}</span>;
}

export function Spinner({ className = 'size-6' }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent text-brand-600 ${className}`} role="status" aria-label="Cargando" />;
}

export function Loading() {
  return <div className="flex justify-center py-16"><Spinner className="size-8" /></div>;
}

export function Empty({ icon = 'box', title, children, action }) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <div className="mb-3 rounded-full bg-ink-100 p-4 text-ink-400 dark:bg-ink-800"><Icon name={icon} className="size-8" /></div>
      <h3 className="text-xl font-bold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Mensaje de error general de un formulario */
export function FormError({ error }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
      <Icon name="alert" className="mt-0.5 size-4 shrink-0" /> <span>{error}</span>
    </div>
  );
}

/** Modal accesible basado en <dialog> */
export function Modal({ open, onClose, title, children, size = 'max-w-lg' }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose}
      className={`m-auto w-[calc(100%-2rem)] ${size} rounded-xl bg-white p-0 text-ink-800 shadow-2xl backdrop:bg-black/50 dark:bg-ink-900 dark:text-ink-100`}>
      {open && (
        <div className="max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-200 bg-white px-5 py-3 dark:border-ink-800 dark:bg-ink-900">
            <h2 className="text-xl font-bold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded p-1 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Cerrar"><Icon name="x" /></button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Paginación">
      <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}><Icon name="chevronLeft" className="size-4" /> Anterior</button>
      <span className="px-2 text-sm text-ink-500">Página {page} de {pages}</span>
      <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente <Icon name="chevronRight" className="size-4" /></button>
    </nav>
  );
}

export function Stars({ value = 0, size = 'size-4' }) {
  return (
    <span className="inline-flex text-amber-500" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" className={size} fill={i <= Math.round(value) ? 'currentColor' : 'none'} strokeWidth={1.5} />
      ))}
    </span>
  );
}

/** Tarjeta de indicador para dashboards */
export function Stat({ label, value, hint, icon, tone = 'ink' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</span>
        {icon && <Icon name={icon} className={`size-5 ${tone === 'brand' ? 'text-brand-600' : 'text-ink-400'}`} />}
      </div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}
