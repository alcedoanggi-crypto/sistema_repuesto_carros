// Validación declarativa de cuerpos de petición.
// Uso: validate({ email: 'required|email', stock: 'int|min:0' }, { stock: 'Stock' })
import { HttpError } from '../utils/errors.js';

const RULES = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || 'Correo electrónico inválido',
  number: (v, _a, l) => !Number.isNaN(Number(v)) || `${l} debe ser un número`,
  int: (v, _a, l) => Number.isInteger(Number(v)) || `${l} debe ser un número entero`,
  min: (v, a, l) => Number(v) >= Number(a) || `${l} debe ser mayor o igual a ${a}`,
  max: (v, a, l) => Number(v) <= Number(a) || `${l} debe ser menor o igual a ${a}`,
  minlen: (v, a, l) => String(v).length >= Number(a) || `${l} debe tener al menos ${a} caracteres`,
  maxlen: (v, a, l) => String(v).length <= Number(a) || `${l} admite máximo ${a} caracteres`,
  in: (v, a, l) => a.split(',').includes(String(v)) || `${l} tiene un valor no permitido`,
  // Cédula o RIF venezolano: V-12345678, E-1234567, J-40123456-7
  docid: (v) => /^[VEJGP]-?\d{6,9}(-?\d)?$/i.test(String(v).trim()) || 'Cédula/RIF inválido (ej: V-12345678 o J-40123456-7)',
  // Teléfonos venezolanos: 0414-1234567, +58 414 1234567, 0212-5551234
  phone: (v) => /^(\+?58[\s-]?)?0?\d{3}[\s-]?\d{3}[\s-]?\d{4}$/.test(String(v).trim()) || 'Teléfono inválido (ej: 0414-1234567)',
};

/** Lanza HttpError 422 con un mapa campo → mensaje si algo no cumple */
export function check(data, rules, labels = {}) {
  const errors = {};
  for (const [field, ruleStr] of Object.entries(rules)) {
    const value = data[field];
    const label = labels[field] || field;
    const list = ruleStr.split('|');
    if (value === undefined || value === null || value === '') {
      if (list.includes('required')) errors[field] = `${label} es obligatorio`;
      continue;
    }
    for (const rule of list) {
      const [name, arg] = rule.split(':');
      const fn = RULES[name];
      const res = fn ? fn(value, arg, label) : true;
      if (res !== true) { errors[field] = res; break; }
    }
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'Revisa los datos del formulario', errors);
}

export const validate = (rules, labels) => (req, _res, next) => {
  try {
    check(req.body || {}, rules, labels);
    next();
  } catch (e) {
    next(e);
  }
};
