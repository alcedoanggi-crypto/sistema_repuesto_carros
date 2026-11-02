// Tabla + formulario modal genérico para tablas simples (proveedores, cupones, zonas, métodos de pago...)
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';
import { Empty, Field, FormError, Input, Loading, Modal, Select, Textarea } from '../components/ui.jsx';

/** Convierte una fecha ISO al formato que espera <input type="datetime-local"> en hora de Venezuela */
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 4 * 3600e3); // Venezuela: UTC-4
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(`${v}:00-04:00`).toISOString() : null);

/**
 * @param endpoint   ruta base de la API (ej. /admin/purchasing/suppliers)
 * @param columns    [{ key, label, render?(row) }]
 * @param fields     [{ key, label, type: text|number|select|checkbox|textarea|datetime|tags, options?, hint?, span? }]
 * @param defaults   valores iniciales del formulario
 */
export default function CrudPage({ title, endpoint, columns, fields, defaults = {}, singular = 'registro', deletable = true }) {
  const { toast } = useApp();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api.get(endpoint).then(setRows).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, [endpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (row) => {
    setErrors({}); setError('');
    if (!row) return setEdit({ ...defaults });
    const form = { ...row };
    fields.forEach((f) => {
      if (f.type === 'datetime') form[f.key] = toLocalInput(row[f.key]);
      if (f.type === 'tags') form[f.key] = (row[f.key] || []).join(', ');
    });
    setEdit(form);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErrors({}); setError('');
    const body = { ...edit };
    fields.forEach((f) => { if (f.type === 'datetime') body[f.key] = fromLocalInput(edit[f.key]); });
    try {
      if (edit.id) await api.put(`${endpoint}/${edit.id}`, body); else await api.post(endpoint, body);
      toast(`${singular[0].toUpperCase() + singular.slice(1)} guardado`);
      setEdit(null);
      load();
    } catch (err) { setErrors(err.details); setError(err.message); } finally { setSaving(false); }
  };

  const remove = async (row) => {
    if (!window.confirm(`¿Eliminar este ${singular}?`)) return;
    try { await api.del(`${endpoint}/${row.id}`); toast(`${singular} eliminado`); load(); } catch (e) { toast(e.message, 'error'); }
  };

  const input = (f) => {
    const common = { value: edit[f.key] ?? '', error: errors[f.key], onChange: (e) => setEdit({ ...edit, [f.key]: e.target.value }) };
    if (f.type === 'checkbox') {
      return (
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={!!edit[f.key]} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.checked })} /> {f.label}
        </label>
      );
    }
    if (f.type === 'select') return <Select {...common}><option value="">Selecciona</option>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>;
    if (f.type === 'textarea') return <Textarea {...common} />;
    if (f.type === 'datetime') return <Input type="datetime-local" {...common} />;
    return <Input type={f.type === 'number' ? 'number' : 'text'} step="any" {...common} />;
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <button className="btn-primary btn-sm" onClick={() => open(null)}><Icon name="plus" className="size-4" /> Nuevo</button>
      </div>
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title={`Sin ${title.toLowerCase()}`} /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th className="w-24" /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
                  <td className="text-right whitespace-nowrap">
                    <button className="rounded p-1.5 hover:bg-ink-100 dark:hover:bg-ink-800" onClick={() => open(r)} aria-label="Editar"><Icon name="edit" className="size-4" /></button>
                    {deletable && <button className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => remove(r)} aria-label="Eliminar"><Icon name="trash" className="size-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Editar ${singular}` : `Nuevo ${singular}`}>
        {edit && (
          <form onSubmit={save} className="space-y-3" noValidate>
            <FormError error={error} />
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.filter((f) => !f.showIf || f.showIf(edit)).map((f) => (
                <div key={f.key} className={f.span === 2 || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  {f.type === 'checkbox' ? input(f) : <Field label={f.label} error={errors[f.key]} hint={f.hint}>{input(f)}</Field>}
                </div>
              ))}
            </div>
            <button className="btn-primary w-full" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
