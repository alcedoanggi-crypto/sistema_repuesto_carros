// Panel → Productos: CRUD, fotos, compatibilidad, importar/exportar Excel o CSV
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { db } from '../../db/index.js';
import { check } from '../../middleware/validate.js';
import { HttpError, notFound } from '../../utils/errors.js';
import { slugify, bool } from '../../utils/helpers.js';
import { searchProducts, productCompatibility, PRODUCT_SELECT } from '../../services/catalog.js';
import { moveStock } from '../../services/orders.js';
import { UPLOAD_DIR } from '../../paths.js';

const r = Router();

// ---------- Subida de archivos ----------
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(10).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) ? cb(null, true) : cb(new HttpError(400, 'Solo se permiten imágenes JPG, PNG, WEBP o GIF')),
});
const sheetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ---------- Validación ----------
const RULES = {
  name: 'required|minlen:3|maxlen:200', sku: 'required|maxlen:40', category_id: 'required|int',
  cost_price: 'required|number|min:0', price: 'required|number|min:0.01',
  price_workshop: 'number|min:0', price_wholesale: 'number|min:0',
  stock: 'int|min:0', min_stock: 'required|int|min:0', warranty_months: 'int|min:0|max:120',
};
const LABELS = {
  name: 'Nombre', sku: 'SKU', category_id: 'Categoría', cost_price: 'Precio de costo', price: 'Precio de venta',
  price_workshop: 'Precio taller', price_wholesale: 'Precio mayorista', stock: 'Stock', min_stock: 'Stock mínimo',
  warranty_months: 'Garantía',
};
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function validateProduct(b) {
  check(b, RULES, LABELS);
  if (Number(b.price) < Number(b.cost_price)) {
    throw new HttpError(422, 'Revisa los datos del formulario', { price: 'El precio de venta es menor que el costo' });
  }
}

/** Genera un slug único a partir del nombre */
async function uniqueSlug(name, exceptId = 0) {
  const base = slugify(name) || 'producto';
  let slug = base, n = 1;
  while (await db.one('SELECT 1 FROM products WHERE slug = $1 AND id <> $2', [slug, exceptId])) slug = `${base}-${++n}`;
  return slug;
}

// ---------- Listado y detalle ----------
r.get('/', async (req, res) => {
  res.json(await searchProducts({ ...req.query, sort: req.query.sort || 'name' }, { includeInactive: true, defLimit: 25 }));
});

r.get('/:id', async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next(); // deja pasar /export
  const p = await db.one(`${PRODUCT_SELECT} WHERE p.id = $1`, [Number(req.params.id)]);
  if (!p) throw notFound('Producto');
  res.json({ ...p, compatibility: await productCompatibility(p.id) });
});

// ---------- Crear / editar / eliminar ----------
r.post('/', async (req, res) => {
  const b = req.body;
  validateProduct(b);
  const slug = await uniqueSlug(b.name); // fuera de la transacción (PGlite usa una sola conexión)
  const id = await db.tx(async (t) => {
    const { rows: [p] } = await t.query(
      `INSERT INTO products (sku, oem_number, manufacturer_code, name, slug, description, category_id, brand_id,
         is_original, cost_price, price, price_workshop, price_wholesale, stock, min_stock, warehouse_location,
         warranty_months, images, featured, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [b.sku.trim().toUpperCase(), b.oem_number || null, b.manufacturer_code || null, b.name.trim(), slug,
       b.description || null, Number(b.category_id), num(b.brand_id), bool(b.is_original), Number(b.cost_price), Number(b.price),
       num(b.price_workshop), num(b.price_wholesale), Number(b.min_stock), b.warehouse_location || null,
       Number(b.warranty_months ?? 3), JSON.stringify(b.images || []), bool(b.featured), b.active === undefined ? true : bool(b.active)]
    );
    // El stock inicial queda registrado como movimiento de entrada
    if (Number(b.stock) > 0) {
      await moveStock(t, { productId: p.id, qty: Number(b.stock), type: 'entrada', reason: 'Stock inicial', userId: req.user.id });
    }
    return p.id;
  });
  res.status(201).json({ id });
});

r.put('/:id', async (req, res) => {
  const b = req.body;
  const id = Number(req.params.id);
  validateProduct(b);
  const current = await db.one('SELECT name, slug FROM products WHERE id = $1', [id]);
  if (!current) throw notFound('Producto');
  const slug = current.name === b.name.trim() ? current.slug : await uniqueSlug(b.name, id);
  // El stock NO se edita aquí: se cambia con movimientos de inventario para mantener el historial
  await db.query(
    `UPDATE products SET sku=$1, oem_number=$2, manufacturer_code=$3, name=$4, slug=$5, description=$6, category_id=$7,
       brand_id=$8, is_original=$9, cost_price=$10, price=$11, price_workshop=$12, price_wholesale=$13, min_stock=$14,
       warehouse_location=$15, warranty_months=$16, images=$17, featured=$18, active=$19, updated_at=NOW()
     WHERE id = $20`,
    [b.sku.trim().toUpperCase(), b.oem_number || null, b.manufacturer_code || null, b.name.trim(), slug, b.description || null,
     Number(b.category_id), num(b.brand_id), bool(b.is_original), Number(b.cost_price), Number(b.price), num(b.price_workshop),
     num(b.price_wholesale), Number(b.min_stock), b.warehouse_location || null, Number(b.warranty_months ?? 3),
     JSON.stringify(b.images || []), bool(b.featured), bool(b.active), id]
  );
  res.json({ id, slug });
});

r.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  // Si tiene ventas no se borra (se perdería el historial): se desactiva
  const sold = await db.one('SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1', [id]);
  if (sold) {
    await db.query('UPDATE products SET active = FALSE WHERE id = $1', [id]);
    return res.json({ deactivated: true, message: 'El producto tiene ventas registradas: se desactivó en lugar de eliminarse.' });
  }
  await db.query('DELETE FROM products WHERE id = $1', [id]);
  res.status(204).end();
});

// ---------- Fotos ----------
r.post('/images', imageUpload.array('images', 8), (req, res) => {
  res.status(201).json((req.files || []).map((f) => `/uploads/${f.filename}`));
});

// ---------- Compatibilidad del producto ----------
/** Reemplaza la lista de vehículos compatibles: { vehicles: [{ vehicle_id, note }] } */
r.put('/:id/compatibility', async (req, res) => {
  const id = Number(req.params.id);
  const list = Array.isArray(req.body.vehicles) ? req.body.vehicles : [];
  await db.tx(async (t) => {
    await t.query('DELETE FROM product_vehicles WHERE product_id = $1', [id]);
    for (const v of list) {
      await t.query(
        'INSERT INTO product_vehicles (product_id, vehicle_id, note) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [id, Number(v.vehicle_id), v.note || null]
      );
    }
  });
  res.json(await productCompatibility(id));
});

// ---------- Exportar ----------
const COLUMNS = [
  ['sku', 'SKU', 14], ['name', 'Nombre', 40], ['oem_number', 'OEM', 16], ['manufacturer_code', 'Codigo fabricante', 18],
  ['brand_name', 'Marca', 14], ['category_name', 'Categoria', 18], ['is_original', 'Original', 9],
  ['cost_price', 'Costo', 12], ['price', 'Precio', 12], ['price_workshop', 'Precio taller', 13],
  ['price_wholesale', 'Precio mayorista', 15], ['stock', 'Stock', 8], ['min_stock', 'Stock minimo', 12],
  ['warehouse_location', 'Ubicacion', 12], ['warranty_months', 'Garantia meses', 14], ['description', 'Descripcion', 50],
  ['compatibility', 'Compatibilidad', 60],
];

r.get('/export', async (req, res) => {
  const rows = await db.many(
    `${PRODUCT_SELECT.replace('SELECT p.*', `SELECT p.*, (
       SELECT STRING_AGG(mk.name || '/' || md.name || '/' || v.year || '/' || v.engine, '; ' ORDER BY mk.name, md.name, v.year)
       FROM product_vehicles pv JOIN vehicles v ON v.id = pv.vehicle_id JOIN vehicle_models md ON md.id = v.model_id
       JOIN vehicle_makes mk ON mk.id = md.make_id WHERE pv.product_id = p.id) AS compatibility`)} ORDER BY p.sku`
  );
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Productos');
  ws.columns = COLUMNS.map(([key, header, width]) => ({ key, header, width }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
  rows.forEach((p) => ws.addRow({ ...p, is_original: p.is_original ? 'si' : 'no' }));

  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="productos-macai.csv"');
    res.write('﻿'); // BOM para que Excel abra bien los acentos
    await wb.csv.write(res, { formatterOptions: { delimiter: ';' } });
    return res.end();
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="productos-macai.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

// ---------- Importar ----------
/**
 * Acepta .xlsx o .csv con las mismas columnas de la exportación.
 * Crea o actualiza por SKU. Marca y categoría se buscan por nombre (la marca se crea si no existe).
 * Compatibilidad: "Marca/Modelo/Año(s)/Motor; ..." — años como 2009 o 2009-2013; el motor es opcional.
 */
r.post('/import', sheetUpload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Adjunta un archivo .xlsx o .csv');
  const wb = new ExcelJS.Workbook();
  const isCsv = /\.csv$/i.test(req.file.originalname);
  if (isCsv) {
    const { Readable } = await import('node:stream');
    const text = req.file.buffer.toString('utf8').replace(/^﻿/, '');
    const delimiter = (text.split('\n')[0].match(/;/g) || []).length >= 2 ? ';' : ',';
    await wb.csv.read(Readable.from([text]), { parserOptions: { delimiter } });
  } else {
    await wb.xlsx.load(req.file.buffer);
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new HttpError(400, 'El archivo no tiene hojas');

  // Mapa encabezado → índice de columna (tolerante a mayúsculas y acentos)
  const norm = (s) => slugify(String(s ?? '')).replace(/-/g, '');
  const headerIndex = {};
  ws.getRow(1).eachCell((cell, col) => { headerIndex[norm(cell.text ?? cell.value)] = col; });
  const keyFor = Object.fromEntries(COLUMNS.map(([key, header]) => [key, headerIndex[norm(header)] ?? headerIndex[norm(key)]]));
  if (!keyFor.sku || !keyFor.name || !keyFor.price) {
    throw new HttpError(400, 'Faltan columnas obligatorias: SKU, Nombre y Precio');
  }

  const categories = await db.many('SELECT id, name, slug FROM categories');
  const result = { created: 0, updated: 0, errors: [] };

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const get = (k) => {
      if (!keyFor[k]) return '';
      const v = row.getCell(keyFor[k]).value;
      return v && typeof v === 'object' && 'result' in v ? v.result : v ?? '';
    };
    const sku = String(get('sku')).trim().toUpperCase();
    if (!sku) continue; // fila vacía
    try {
      const catName = String(get('category_name')).trim();
      const cat = categories.find((c) => norm(c.name) === norm(catName) || c.slug === slugify(catName));
      if (!cat) throw new Error(`Categoría "${catName}" no existe`);
      let brandId = null;
      const brandName = String(get('brand_name')).trim();
      if (brandName) {
        brandId = (await db.one(
          `INSERT INTO part_brands (name, slug) VALUES ($1, $2)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [brandName, slugify(brandName)]
        )).id;
      }
      const data = {
        sku, name: String(get('name')).trim(), category_id: cat.id, cost_price: get('cost_price') || 0,
        price: get('price'), price_workshop: get('price_workshop'), price_wholesale: get('price_wholesale'),
        stock: get('stock') || 0, min_stock: get('min_stock') || 0, warranty_months: get('warranty_months') || 3,
      };
      check(data, RULES, LABELS);

      const existing = await db.one('SELECT id, stock FROM products WHERE sku = $1', [sku]);
      const fields = [
        get('oem_number') || null, get('manufacturer_code') || null, data.name, get('description') || null, cat.id, brandId,
        /^(si|sí|yes|true|1|original)$/i.test(String(get('is_original'))), Number(data.cost_price), Number(data.price),
        num(data.price_workshop), num(data.price_wholesale), Number(data.min_stock), get('warehouse_location') || null,
        Number(data.warranty_months),
      ];
      await db.tx(async (t) => {
        let id;
        if (existing) {
          id = existing.id;
          await t.query(
            `UPDATE products SET oem_number=$1, manufacturer_code=$2, name=$3, description=$4, category_id=$5, brand_id=$6,
               is_original=$7, cost_price=$8, price=$9, price_workshop=$10, price_wholesale=$11, min_stock=$12,
               warehouse_location=$13, warranty_months=$14, updated_at=NOW() WHERE id = $15`, [...fields, id]
          );
          // Si el stock del archivo es distinto, se registra como ajuste
          const diff = Number(data.stock) - existing.stock;
          if (keyFor.stock && diff !== 0) {
            await moveStock(t, { productId: id, qty: diff, type: 'ajuste', reason: 'Importación desde archivo', userId: req.user.id });
          }
        } else {
          id = (await t.query(
            `INSERT INTO products (oem_number, manufacturer_code, name, description, category_id, brand_id, is_original,
               cost_price, price, price_workshop, price_wholesale, min_stock, warehouse_location, warranty_months, sku, slug)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
            [...fields, sku, `${slugify(data.name)}-${sku.toLowerCase()}`]
          )).rows[0].id;
          if (Number(data.stock) > 0) {
            await moveStock(t, { productId: id, qty: Number(data.stock), type: 'entrada', reason: 'Importación desde archivo', userId: req.user.id });
          }
        }
        // Compatibilidad (solo si la columna trae datos)
        const compat = String(get('compatibility')).trim();
        if (compat) {
          await t.query('DELETE FROM product_vehicles WHERE product_id = $1', [id]);
          for (const entry of compat.split(';').map((s) => s.trim()).filter(Boolean)) {
            const [make, model, years, engine] = entry.split('/').map((s) => s?.trim());
            const [y1, y2] = String(years || '').split('-').map(Number);
            if (!make || !model || !y1) throw new Error(`Compatibilidad mal escrita: "${entry}"`);
            const vs = (await t.query(
              `SELECT v.id FROM vehicles v JOIN vehicle_models md ON md.id = v.model_id JOIN vehicle_makes mk ON mk.id = md.make_id
               WHERE LOWER(mk.name) = LOWER($1) AND LOWER(md.name) = LOWER($2) AND v.year BETWEEN $3 AND $4
                 AND ($5::text IS NULL OR LOWER(v.engine) = LOWER($5))`,
              [make, model, y1, y2 || y1, engine || null]
            )).rows;
            if (!vs.length) throw new Error(`No hay vehículos registrados para "${entry}"`);
            for (const v of vs) {
              await t.query('INSERT INTO product_vehicles (product_id, vehicle_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, v.id]);
            }
          }
        }
      });
      existing ? result.updated++ : result.created++;
    } catch (e) {
      const msg = e.details ? Object.values(e.details).join(', ') : e.message;
      result.errors.push({ row: i, sku, error: msg });
    }
  }
  res.json(result);
});

export default r;
