// Panel → Reportes: ventas, utilidad por producto e inventario valorizado.
// Cada reporte se puede pedir como JSON (pantalla), Excel (?format=xlsx) o PDF (?format=pdf).
import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { db } from '../../db/index.js';
import { HttpError } from '../../utils/errors.js';
import { bs } from '../../utils/helpers.js';

const r = Router();

/** Rango de fechas por defecto: mes en curso */
function range(q) {
  const now = new Date();
  const from = q.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = q.to || now.toISOString().slice(0, 10);
  if (from > to) throw new HttpError(422, 'La fecha inicial debe ser anterior a la final');
  return { from, to };
}

// Definición de cada reporte: título, columnas y consulta
const REPORTS = {
  ventas: {
    title: 'Reporte de ventas',
    columns: [['day', 'Fecha', 'text'], ['orders', 'Pedidos', 'int'], ['subtotal', 'Subtotal', 'money'],
              ['discount', 'Descuentos', 'money'], ['tax', 'IVA', 'money'], ['shipping', 'Envíos', 'money'], ['total', 'Total', 'money']],
    query: ({ from, to }) => db.many(
      `SELECT to_char((created_at AT TIME ZONE 'America/Caracas')::date, 'DD/MM/YYYY') AS day, COUNT(*) AS orders,
              SUM(subtotal) AS subtotal, SUM(discount) AS discount, SUM(tax) AS tax, SUM(shipping_cost) AS shipping, SUM(total) AS total
       FROM orders WHERE status <> 'cancelado' AND created_at >= $1::date AND created_at < $2::date + 1
       GROUP BY (created_at AT TIME ZONE 'America/Caracas')::date ORDER BY (created_at AT TIME ZONE 'America/Caracas')::date`, [from, to]
    ),
  },
  utilidad: {
    title: 'Utilidad por producto',
    columns: [['sku', 'SKU', 'text'], ['name', 'Producto', 'text'], ['qty', 'Unidades', 'int'], ['revenue', 'Venta', 'money'],
              ['cost', 'Costo', 'money'], ['profit', 'Utilidad', 'money'], ['margin', 'Margen %', 'pct']],
    query: ({ from, to }) => db.many(
      `SELECT oi.sku, oi.name, SUM(oi.quantity) AS qty, SUM(oi.total) AS revenue, SUM(oi.unit_cost * oi.quantity) AS cost,
              SUM(oi.total - oi.unit_cost * oi.quantity) AS profit,
              ROUND((SUM(oi.total - oi.unit_cost * oi.quantity) / NULLIF(SUM(oi.total), 0) * 100)::numeric, 1) AS margin
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status <> 'cancelado' AND o.created_at >= $1::date AND o.created_at < $2::date + 1
       GROUP BY oi.sku, oi.name ORDER BY profit DESC`, [from, to]
    ),
  },
  inventario: {
    title: 'Inventario valorizado',
    noDates: true,
    columns: [['sku', 'SKU', 'text'], ['name', 'Producto', 'text'], ['category', 'Categoría', 'text'], ['stock', 'Stock', 'int'],
              ['cost_price', 'Costo unit.', 'money'], ['cost_value', 'Valor al costo', 'money'], ['sale_value', 'Valor a la venta', 'money']],
    query: () => db.many(
      `SELECT p.sku, p.name, c.name AS category, p.stock, p.cost_price, p.stock * p.cost_price AS cost_value, p.stock * p.price AS sale_value
       FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.active ORDER BY c.name, p.name`
    ),
  },
};

const fmt = (v, type) => (type === 'money' ? bs(v) : type === 'pct' ? `${v ?? 0}%` : String(v ?? ''));

r.get('/:type', async (req, res) => {
  const rep = REPORTS[req.params.type];
  if (!rep) throw new HttpError(404, 'Reporte no encontrado');
  const dates = range(req.query);
  const rows = await rep.query(dates);
  // Totales de las columnas numéricas (excepto porcentajes)
  const totals = {};
  rep.columns.forEach(([k, , t]) => { if (t === 'money' || t === 'int') totals[k] = rows.reduce((s, x) => s + Number(x[k] || 0), 0); });
  const subtitle = rep.noDates ? `Al ${new Date().toLocaleDateString('es-VE')}` : `Del ${dates.from} al ${dates.to}`;
  const filename = `macai-${req.params.type}-${dates.to}`;

  if (req.query.format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(rep.title.slice(0, 30));
    ws.addRow([`MACAI — ${rep.title}`]).font = { bold: true, size: 14 };
    ws.addRow([subtitle]);
    ws.addRow([]);
    const head = ws.addRow(rep.columns.map((c) => c[1]));
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2410C' } }; });
    rows.forEach((x) => ws.addRow(rep.columns.map(([k, , t]) => (t === 'text' ? x[k] : Number(x[k] || 0)))));
    const tr = ws.addRow(rep.columns.map(([k], i) => (i === 0 ? 'TOTAL' : totals[k] ?? '')));
    tr.font = { bold: true };
    rep.columns.forEach(([, , t], i) => {
      const col = ws.getColumn(i + 1);
      col.width = t === 'text' ? 28 : 16;
      if (t === 'money') col.numFmt = '"Bs." #,##0.00';
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  }

  if (req.query.format === 'pdf') {
    const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 36 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    doc.pipe(res);
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#C2410C').text(`MACAI — ${rep.title}`);
    doc.fontSize(10).font('Helvetica').fillColor('#374151').text(subtitle).moveDown();
    const width = doc.page.width - 72;
    const colW = rep.columns.map(([, , t]) => (t === 'text' ? 2.2 : 1));
    const unit = width / colW.reduce((a, b) => a + b, 0);
    const drawRow = (cells, bold = false, fill) => {
      const y = doc.y;
      if (y > doc.page.height - 60) { doc.addPage(); }
      const yy = doc.y;
      if (fill) doc.rect(36, yy - 3, width, 16).fill(fill);
      let x = 36;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(fill === '#111827' ? '#FFFFFF' : '#111827');
      cells.forEach((c, i) => {
        const w = colW[i] * unit;
        doc.text(c, x + 3, yy, { width: w - 6, align: rep.columns[i][2] === 'text' ? 'left' : 'right', lineBreak: false, ellipsis: true });
        x += w;
      });
      doc.y = yy + 16;
    };
    drawRow(rep.columns.map((c) => c[1]), true, '#111827');
    rows.forEach((x, i) => drawRow(rep.columns.map(([k, , t]) => fmt(x[k], t)), false, i % 2 ? '#F9FAFB' : undefined));
    drawRow(rep.columns.map(([k, , t], i) => (i === 0 ? 'TOTAL' : totals[k] !== undefined ? fmt(totals[k], t) : '')), true, '#FED7AA');
    doc.end();
    return;
  }

  res.json({ title: rep.title, subtitle, columns: rep.columns, rows, totals, ...dates });
});

export default r;
