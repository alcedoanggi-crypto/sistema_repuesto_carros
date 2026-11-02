// Lectura/escritura de la configuración de la tienda (tabla settings: clave → JSON)
import { db } from '../db/index.js';

export const DEFAULT_SETTINGS = {
  store: {
    name: 'MACAI Autopartes',
    legal_name: 'Inversiones MACAI, C.A.',
    rif: 'J-50123456-7',
    address: 'Av. Principal de Los Ruices, Edif. MACAI, PB, Caracas, Distrito Capital',
    phone: '0212-555-0101',
    email: 'ventas@macai.com.ve',
    whatsapp: '584141234567',
    hours: 'Lunes a viernes 8:00 a. m. – 6:00 p. m. · Sábados 8:00 a. m. – 2:00 p. m.',
    instagram: '@macai.autopartes',
  },
  tax: { name: 'IVA', rate: 16 },                      // porcentaje
  customer_discounts: { normal: 0, taller: 10, mayorista: 18 }, // % si el producto no tiene precio propio
  pickup: { enabled: true, address: 'Tienda MACAI Los Ruices — retiro en 2 h hábiles tras confirmar el pago' },
};

/**
 * Devuelve todas las claves de configuración combinadas con los valores por defecto.
 * @param q ejecutor (db o transacción en curso: PGlite usa una sola conexión)
 */
export async function getSettings(q = db) {
  const { rows } = await q.query('SELECT key, value FROM settings');
  const out = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows) out[r.key] = { ...(out[r.key] || {}), ...r.value };
  return out;
}

export async function saveSetting(key, value) {
  await db.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)]
  );
}
