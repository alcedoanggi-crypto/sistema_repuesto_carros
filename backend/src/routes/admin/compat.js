// Panel → Compatibilidad: catálogo de marcas, modelos, años y motores de vehículos
import { Router } from 'express';
import { db } from '../../db/index.js';
import { check } from '../../middleware/validate.js';
import { HttpError, notFound } from '../../utils/errors.js';
import { slugify } from '../../utils/helpers.js';

const r = Router();

// ---------- Marcas de vehículos ----------
r.get('/makes', async (_req, res) => {
  res.json(await db.many(
    `SELECT mk.*, (SELECT COUNT(*) FROM vehicle_models m WHERE m.make_id = mk.id) AS model_count
     FROM vehicle_makes mk ORDER BY mk.name`
  ));
});
r.post('/makes', async (req, res) => {
  check(req.body, { name: 'required|maxlen:60' }, { name: 'Marca' });
  res.status(201).json(await db.one('INSERT INTO vehicle_makes (name, slug) VALUES ($1, $2) RETURNING *',
    [req.body.name.trim(), slugify(req.body.name)]));
});
r.put('/makes/:id', async (req, res) => {
  check(req.body, { name: 'required|maxlen:60' }, { name: 'Marca' });
  const row = await db.one('UPDATE vehicle_makes SET name = $1, slug = $2 WHERE id = $3 RETURNING *',
    [req.body.name.trim(), slugify(req.body.name), Number(req.params.id)]);
  if (!row) throw notFound('Marca');
  res.json(row);
});
r.delete('/makes/:id', async (req, res) => {
  await db.query('DELETE FROM vehicle_makes WHERE id = $1', [Number(req.params.id)]);
  res.status(204).end();
});

// ---------- Modelos ----------
r.get('/models', async (req, res) => {
  res.json(await db.many(
    `SELECT m.*, (SELECT COUNT(*) FROM vehicles v WHERE v.model_id = m.id) AS vehicle_count,
            (SELECT MIN(year) FROM vehicles v WHERE v.model_id = m.id) AS year_from,
            (SELECT MAX(year) FROM vehicles v WHERE v.model_id = m.id) AS year_to
     FROM vehicle_models m WHERE m.make_id = $1 ORDER BY m.name`, [Number(req.query.make_id)]
  ));
});
r.post('/models', async (req, res) => {
  check(req.body, { make_id: 'required|int', name: 'required|maxlen:80' }, { name: 'Modelo' });
  res.status(201).json(await db.one('INSERT INTO vehicle_models (make_id, name) VALUES ($1, $2) RETURNING *',
    [Number(req.body.make_id), req.body.name.trim()]));
});
r.put('/models/:id', async (req, res) => {
  check(req.body, { name: 'required|maxlen:80' }, { name: 'Modelo' });
  const row = await db.one('UPDATE vehicle_models SET name = $1 WHERE id = $2 RETURNING *', [req.body.name.trim(), Number(req.params.id)]);
  if (!row) throw notFound('Modelo');
  res.json(row);
});
r.delete('/models/:id', async (req, res) => {
  await db.query('DELETE FROM vehicle_models WHERE id = $1', [Number(req.params.id)]);
  res.status(204).end();
});

// ---------- Versiones (año + motor) ----------
r.get('/vehicles', async (req, res) => {
  res.json(await db.many(
    `SELECT v.*, (SELECT COUNT(*) FROM product_vehicles pv WHERE pv.vehicle_id = v.id) AS product_count
     FROM vehicles v WHERE v.model_id = $1 ORDER BY v.year DESC, v.engine`, [Number(req.query.model_id)]
  ));
});

/** Crea en lote: un motor para un rango de años { model_id, year_from, year_to, engines: ['1.6L', '1.8L'] } */
r.post('/vehicles', async (req, res) => {
  const b = req.body;
  check(b, { model_id: 'required|int', year_from: 'required|int|min:1950|max:2100', year_to: 'required|int|min:1950|max:2100' },
    { year_from: 'Año desde', year_to: 'Año hasta' });
  const engines = (Array.isArray(b.engines) ? b.engines : String(b.engines || '').split(','))
    .map((e) => e.trim()).filter(Boolean);
  if (!engines.length) throw new HttpError(422, 'Revisa los datos del formulario', { engines: 'Indica al menos un motor' });
  if (Number(b.year_to) < Number(b.year_from)) throw new HttpError(422, 'Revisa los datos del formulario', { year_to: 'Debe ser mayor o igual al año desde' });
  if (Number(b.year_to) - Number(b.year_from) > 40) throw new HttpError(422, 'El rango máximo es de 40 años');
  let created = 0;
  await db.tx(async (t) => {
    for (let y = Number(b.year_from); y <= Number(b.year_to); y++) {
      for (const e of engines) {
        const { rows } = await t.query(
          'INSERT INTO vehicles (model_id, year, engine) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id',
          [Number(b.model_id), y, e]
        );
        created += rows.length;
      }
    }
  });
  res.status(201).json({ created });
});

r.delete('/vehicles/:id', async (req, res) => {
  await db.query('DELETE FROM vehicles WHERE id = $1', [Number(req.params.id)]);
  res.status(204).end();
});

/** Búsqueda de vehículos para asignar compatibilidad desde la ficha del producto */
r.get('/search', async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.make_id) { params.push(Number(req.query.make_id)); where.push(`mk.id = $${params.length}`); }
  if (req.query.model_id) { params.push(Number(req.query.model_id)); where.push(`md.id = $${params.length}`); }
  if (req.query.year_from) { params.push(Number(req.query.year_from)); where.push(`v.year >= $${params.length}`); }
  if (req.query.year_to) { params.push(Number(req.query.year_to)); where.push(`v.year <= $${params.length}`); }
  if (req.query.engine) { params.push(req.query.engine); where.push(`v.engine = $${params.length}`); }
  res.json(await db.many(
    `SELECT v.id AS vehicle_id, mk.name AS make, md.name AS model, v.year, v.engine
     FROM vehicles v JOIN vehicle_models md ON md.id = v.model_id JOIN vehicle_makes mk ON mk.id = md.make_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY mk.name, md.name, v.year, v.engine LIMIT 500`, params
  ));
});

export default r;
