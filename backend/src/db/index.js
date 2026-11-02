// Capa de acceso a datos.
// - Con DATABASE_URL → PostgreSQL / Supabase mediante `pg`.
// - Sin DATABASE_URL → PGlite (PostgreSQL embebido en WASM) guardado en ./data.
// Ambos exponen la misma interfaz: query(sql, params) y tx(fn).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let driverPromise; // Promise<{ query, tx, exec }>

async function connect() {
  let driver;
  if (config.databaseUrl) {
    const pg = (await import('pg')).default;
    // NUMERIC y BIGINT llegan como string en pg: los convertimos a número
    pg.types.setTypeParser(1700, parseFloat);
    pg.types.setTypeParser(20, (v) => parseInt(v, 10));
    const pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    });
    driver = {
      query: (text, params) => pool.query(text, params),
      exec: (text) => pool.query(text),
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn({ query: (t, p) => client.query(t, p) });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
    };
    console.log('[db] Conectado a PostgreSQL');
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dataDir = path.resolve(__dirname, '../../data');
    fs.mkdirSync(dataDir, { recursive: true });
    const pglite = new PGlite(dataDir, {
      parsers: { 1700: (v) => parseFloat(v), 20: (v) => parseInt(v, 10) },
    });
    await pglite.waitReady;
    driver = {
      query: (text, params) => pglite.query(text, params),
      exec: (text) => pglite.exec(text),
      tx: (fn) => pglite.transaction((t) => fn({ query: (q, p) => t.query(q, p) })),
    };
    console.log('[db] Usando PGlite local en', dataDir);
  }
  // Crea las tablas si no existen (idempotente)
  await driver.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return driver;
}

const init = () => (driverPromise ??= connect());

export const db = {
  init,
  /** Ejecuta SQL con varias sentencias (sin parámetros) */
  exec: async (text) => (await init()).exec(text),
  query: async (text, params = []) => (await init()).query(text, params),
  /** Ejecuta varias consultas en una transacción: db.tx(async (t) => { await t.query(...) }) */
  tx: async (fn) => (await init()).tx(fn),
  /** Atajo: devuelve la primera fila o null */
  one: async (text, params = []) => (await (await init()).query(text, params)).rows[0] || null,
  /** Atajo: devuelve todas las filas */
  many: async (text, params = []) => (await (await init()).query(text, params)).rows,
};
