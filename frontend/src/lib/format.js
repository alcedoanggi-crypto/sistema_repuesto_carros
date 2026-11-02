// Formatos para Venezuela

/** 1234.5 → "Bs. 1.234,50" */
export const bs = (n) =>
  'Bs. ' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Versión corta para gráficos: 1250000 → "Bs. 1,3 M" */
export const bsShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1e6) return `Bs. ${(v / 1e6).toLocaleString('es-VE', { maximumFractionDigits: 1 })} M`;
  if (v >= 1e3) return `Bs. ${(v / 1e3).toLocaleString('es-VE', { maximumFractionDigits: 0 })} mil`;
  return bs(v);
};

const TZ = 'America/Caracas';
export const date = (d) => new Date(d).toLocaleDateString('es-VE', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
export const dateTime = (d) =>
  new Date(d).toLocaleString('es-VE', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const STATUS = {
  pendiente: { label: 'Pendiente de pago', color: 'amber' },
  pagado: { label: 'Pagado', color: 'blue' },
  preparacion: { label: 'En preparación', color: 'violet' },
  enviado: { label: 'Enviado', color: 'sky' },
  entregado: { label: 'Entregado', color: 'green' },
  cancelado: { label: 'Cancelado', color: 'red' },
};

export const CUSTOMER_TYPES = { normal: 'Normal', taller: 'Taller', mayorista: 'Mayorista' };

export const VE_STATES = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro',
  'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta',
  'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
];

/** Descripción corta de un vehículo */
export const vehicleLabel = (v) => (v ? `${v.make} ${v.model} ${v.year} · ${v.engine}` : '');
