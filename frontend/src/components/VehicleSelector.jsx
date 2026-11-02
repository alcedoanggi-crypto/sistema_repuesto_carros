// Buscador por compatibilidad: Marca → Modelo → Año → Motor.
// Al confirmar guarda el vehículo como "Mi vehículo" y lleva al catálogo filtrado.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { vehicleLabel } from '../lib/format.js';
import Icon from './Icon.jsx';

export default function VehicleSelector({ compact = false, onDone }) {
  const { vehicle, setVehicle, user, toast } = useApp();
  const navigate = useNavigate();
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [engines, setEngines] = useState([]);
  const [sel, setSel] = useState({ make: '', model: '', year: '', engine: '' });
  const [save, setSave] = useState(true);

  useEffect(() => { api.get('/vehicles/makes').then(setMakes).catch(() => {}); }, []);

  // Cada selección limpia los niveles inferiores y carga el siguiente
  const pickMake = async (make) => {
    setSel({ make, model: '', year: '', engine: '' }); setModels([]); setYears([]); setEngines([]);
    if (make) setModels(await api.get(`/vehicles/models?make_id=${make}`));
  };
  const pickModel = async (model) => {
    setSel((s) => ({ ...s, model, year: '', engine: '' })); setYears([]); setEngines([]);
    if (model) setYears(await api.get(`/vehicles/years?model_id=${model}`));
  };
  const pickYear = async (year) => {
    setSel((s) => ({ ...s, year, engine: '' })); setEngines([]);
    if (year) {
      const list = await api.get(`/vehicles/engines?model_id=${sel.model}&year=${year}`);
      setEngines(list);
      if (list.length === 1) setSel((s) => ({ ...s, engine: String(list[0].id) })); // un solo motor: se elige solo
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!sel.engine) return;
    const v = await api.get(`/vehicles/${sel.engine}`);
    const chosen = { id: v.id, make: v.make, model: v.model, year: v.year, engine: v.engine };
    setVehicle(chosen);
    if (save && user) {
      api.post('/account/vehicles', { vehicle_id: v.id }).then(() => toast('Vehículo guardado en tu garaje')).catch(() => {});
    }
    onDone?.(chosen);
    navigate(`/catalogo?vehicle_id=${v.id}`);
  };

  const sc = 'input appearance-none pr-8 font-medium';
  const steps = [
    { label: 'Marca', value: sel.make, onChange: pickMake, options: makes.map((m) => [m.id, m.name]), disabled: false },
    { label: 'Modelo', value: sel.model, onChange: pickModel, options: models.map((m) => [m.id, m.name]), disabled: !sel.make },
    { label: 'Año', value: sel.year, onChange: pickYear, options: years.map((y) => [y, y]), disabled: !sel.model },
    { label: 'Motor', value: sel.engine, onChange: (v) => setSel((s) => ({ ...s, engine: v })), options: engines.map((x) => [x.id, x.engine]), disabled: !sel.year },
  ];

  return (
    <form onSubmit={submit} className={compact ? '' : 'rounded-2xl bg-white p-4 shadow-xl ring-1 ring-ink-200 sm:p-5 dark:bg-ink-900 dark:ring-ink-800'}>
      {!compact && (
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-lg bg-brand-600 p-1.5 text-white"><Icon name="car" className="size-5" /></span>
          <h2 className="text-2xl font-bold">Busca repuestos para tu vehículo</h2>
        </div>
      )}
      {vehicle && !compact && (
        <p className="mb-3 text-sm text-ink-500">Vehículo actual: <b className="text-ink-800 dark:text-ink-100">{vehicleLabel(vehicle)}</b></p>
      )}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        {steps.map((s, i) => (
          <label key={s.label} className="relative">
            <span className="sr-only">{s.label}</span>
            <select className={sc} value={s.value} disabled={s.disabled} onChange={(e) => s.onChange(e.target.value)}>
              <option value="">{i + 1}. {s.label}</option>
              {s.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Icon name="chevronDown" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-400" />
          </label>
        ))}
        <button type="submit" disabled={!sel.engine} className="btn-primary col-span-2 lg:col-span-1">
          <Icon name="search" className="size-4" /> Ver repuestos
        </button>
      </div>
      {user && (
        <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink-500">
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="accent-brand-600" />
          Guardar en mi garaje
        </label>
      )}
      {!user && !compact && <p className="mt-3 text-xs text-ink-400">Inicia sesión para guardar tu vehículo y encontrarlo siempre.</p>}
    </form>
  );
}
