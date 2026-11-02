// Generador de rutas CRUD para tablas simples del panel (proveedores, cupones, zonas...).
// Evita repetir el mismo código y mantiene la validación en un solo lugar.
import { Router } from 'express';
import { db } from '../db/index.js';
import { check } from '../middleware/validate.js';
import { notFound } from './errors.js';

/**
 * @param {object} o
 * @param {string}   o.table    nombre de la tabla
 * @param {string[]} o.fields   columnas editables
 * @param {object}   o.rules    reglas de validación (ver middleware/validate.js)
 * @param {object}   o.labels   nombres legibles de los campos
 * @param {string}   o.orderBy  ORDER BY del listado
 * @param {Function} o.prepare  (body) => body   normaliza datos antes de guardar
 * @param {string}   o.select   SELECT personalizado para el listado
 */
export function crud({ table, fields, rules = {}, labels = {}, orderBy = 'id', prepare = (b) => b, select }) {
  const r = Router();
  const values = (body) => {
    const b = prepare({ ...body });
    // Los campos vacíos se guardan como NULL; los arrays/objetos van como JSON si hace falta
    return fields.map((f) => (b[f] === '' || b[f] === undefined ? null : b[f]));
  };

  r.get('/', async (_req, res) => {
    res.json(await db.many(select || `SELECT * FROM ${table} ORDER BY ${orderBy}`));
  });

  r.post('/', async (req, res) => {
    check(req.body, rules, labels);
    const cols = fields.join(', ');
    const ph = fields.map((_, i) => `$${i + 1}`).join(', ');
    res.status(201).json(await db.one(`INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING *`, values(req.body)));
  });

  r.put('/:id', async (req, res) => {
    check(req.body, rules, labels);
    const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const row = await db.one(
      `UPDATE ${table} SET ${set} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values(req.body), Number(req.params.id)]
    );
    if (!row) throw notFound();
    res.json(row);
  });

  r.delete('/:id', async (req, res) => {
    const { rowCount, affectedRows } = await db.query(`DELETE FROM ${table} WHERE id = $1`, [Number(req.params.id)]);
    if (!(rowCount ?? affectedRows)) throw notFound();
    res.status(204).end();
  });

  return r;
}
