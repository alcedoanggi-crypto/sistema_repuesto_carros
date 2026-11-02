// Comprobante de pedido en PDF (nota de entrega).
// Nota: en Venezuela la factura fiscal debe emitirse con máquina fiscal o
// imprenta autorizada por el SENIAT; este documento es un comprobante no fiscal.
import PDFDocument from 'pdfkit';
import { bs } from '../utils/helpers.js';
import { getSettings } from './settings.js';
import { STATUS_LABELS } from './orders.js';

const BRAND = '#C2410C';

export async function invoicePdf(o) {
  const { store, tax } = await getSettings();
  const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

  // Encabezado
  doc.rect(0, 0, doc.page.width, 90).fill('#111827');
  doc.fillColor('#FFFFFF').fontSize(24).font('Helvetica-Bold').text('MACAI', 50, 28);
  doc.fontSize(9).font('Helvetica').fillColor('#D1D5DB').text('AUTOPARTES Y REPUESTOS', 50, 56);
  doc.fillColor('#FFFFFF').fontSize(9)
    .text(store.legal_name, 300, 26, { width: 262, align: 'right' })
    .text(`RIF ${store.rif}`, { width: 262, align: 'right' })
    .text(store.phone + ' · ' + store.email, { width: 262, align: 'right' })
    .text(store.address, { width: 262, align: 'right' });

  doc.fillColor(BRAND).fontSize(16).font('Helvetica-Bold').text('COMPROBANTE DE PEDIDO', 50, 115);
  doc.fillColor('#111827').fontSize(10).font('Helvetica')
    .text(`N.º ${o.code}`, 50, 138)
    .text(`Fecha: ${new Date(o.created_at).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`)
    .text(`Estado: ${STATUS_LABELS[o.status]}`);

  // Cliente
  doc.font('Helvetica-Bold').text('Cliente', 320, 138);
  doc.font('Helvetica')
    .text(o.customer_name, 320)
    .text(`C.I./RIF: ${o.customer_doc}`, 320)
    .text(`${o.customer_phone} · ${o.customer_email}`, 320);
  if (o.delivery_type === 'envio' && o.shipping_address) {
    const a = o.shipping_address;
    doc.text(`Envío: ${a.line}, ${a.city}, ${a.state}`, 320, undefined, { width: 242 });
  } else {
    doc.text('Retiro en tienda', 320);
  }

  // Tabla de productos
  let y = 230;
  const cols = [50, 130, 360, 410, 490];
  doc.rect(50, y, 512, 20).fill('#F3F4F6');
  doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9);
  ['SKU', 'Descripción', 'Cant.', 'P. unit.', 'Total'].forEach((h, i) =>
    doc.text(h, cols[i] + 4, y + 6, { width: i >= 2 ? 68 : 220, align: i >= 2 ? 'right' : 'left' }));
  y += 26;
  doc.font('Helvetica').fillColor('#111827');
  for (const it of o.items) {
    const h = Math.max(doc.heightOfString(it.name, { width: 220 }), 12);
    if (y + h > 680) { doc.addPage(); y = 50; }
    doc.text(it.sku, cols[0] + 4, y, { width: 76 });
    doc.text(it.name, cols[1] + 4, y, { width: 220 });
    doc.text(String(it.quantity), cols[2] + 4, y, { width: 40, align: 'right' });
    doc.text(bs(it.unit_price), cols[3] - 24, y, { width: 96, align: 'right' });
    doc.text(bs(it.total), cols[4] - 30, y, { width: 102, align: 'right' });
    y += h + 8;
    doc.moveTo(50, y - 4).lineTo(562, y - 4).strokeColor('#E5E7EB').stroke();
  }

  // Totales
  y += 6;
  const row = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10)
      .text(label, 330, y, { width: 130, align: 'right' })
      .text(value, 462, y, { width: 100, align: 'right' });
    y += bold ? 20 : 15;
  };
  row('Subtotal', bs(o.subtotal));
  if (Number(o.discount) > 0) row(`Descuento${o.coupon_code ? ` (${o.coupon_code})` : ''}`, '- ' + bs(o.discount));
  row(`${tax.name} (${tax.rate}%)`, bs(o.tax));
  row('Envío', Number(o.shipping_cost) ? bs(o.shipping_cost) : 'Gratis');
  doc.fillColor(BRAND); row('TOTAL', bs(o.total), true); doc.fillColor('#111827');

  y += 10;
  doc.fontSize(9).font('Helvetica')
    .text(`Método de pago: ${o.payment_method_name || o.payment_method}${o.payment_reference ? ` · Ref. ${o.payment_reference}` : ''}`, 50, y);
  if (o.tracking_number) doc.text(`Envío: ${o.carrier || ''} · Guía ${o.tracking_number}`);

  doc.fontSize(8).fillColor('#6B7280').text(
    'Documento no fiscal. Garantía según la política publicada en macai.com.ve/garantia. ' +
    'Conserve este comprobante para cualquier reclamo o devolución.',
    50, 720, { width: 512, align: 'center' }
  );
  doc.end();
  return doc;
}
