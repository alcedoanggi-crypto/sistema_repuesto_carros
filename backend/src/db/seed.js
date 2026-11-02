// Datos de ejemplo para probar MACAI.
// Uso: npm run seed            (solo si la base está vacía)
//      npm run seed -- --reset (BORRA todo y vuelve a cargar)
// Los números OEM y precios son ilustrativos para la demo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { slugify, code, money } from '../utils/helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESET = process.argv.includes('--reset');
const RATE = 320; // Bs. por US$ usado solo para que los precios de ejemplo sean coherentes entre sí

await db.init();
const has = await db.one('SELECT COUNT(*) AS n FROM products');
if (has.n > 0 && !RESET) {
  console.log('La base ya tiene datos. Usa "npm run seed -- --reset" para borrarla y recargar los datos de ejemplo.');
  process.exit(0);
}
if (RESET) {
  console.log('Borrando datos existentes...');
  await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
}

const q = (sql, params) => db.query(sql, params);
const one = (sql, params) => db.one(sql, params);

// ---------------- Configuración ----------------
console.log('Configuración, pagos y zonas de envío...');
const PAYMENTS = [
  ['pago_movil', 'Pago Móvil', 'Banco de Venezuela (0102) · RIF J-50123456-7 · Tel. 0414-1234567. Indica el número de referencia.', true],
  ['transferencia', 'Transferencia bancaria', 'Banesco · Cuenta corriente 0134-0000-00-0000000000 · Inversiones MACAI, C.A. · RIF J-50123456-7', true],
  ['zelle', 'Zelle (a tasa BCV del día)', 'pagos@macai.com.ve · Titular: Inversiones MACAI LLC. Indica el nombre del titular y la referencia.', true],
  ['tarjeta', 'Tarjeta de débito/crédito (punto de venta)', 'Pagas con punto de venta al retirar en tienda o al recibir (solo Gran Caracas).', false],
  ['contra_entrega', 'Pago contra entrega (efectivo)', 'Pagas en efectivo al recibir el pedido. Disponible en Gran Caracas.', false],
];
for (const [i, p] of PAYMENTS.entries()) {
  await q('INSERT INTO payment_methods (code, name, instructions, requires_reference, sort_order) VALUES ($1,$2,$3,$4,$5)', [...p, i]);
}
const ZONES = [
  ['Gran Caracas (delivery MACAI)', ['Distrito Capital', 'Miranda'], 900, 60000, '24 horas hábiles'],
  ['Región Central (MRW / Zoom)', ['La Guaira', 'Aragua', 'Carabobo', 'Yaracuy', 'Cojedes'], 1800, 120000, '1-3 días hábiles'],
  ['Occidente (MRW / Zoom)', ['Zulia', 'Lara', 'Falcón', 'Mérida', 'Táchira', 'Trujillo', 'Portuguesa', 'Barinas'], 2400, 150000, '2-4 días hábiles'],
  ['Oriente y Sur (MRW / Tealca)', ['Anzoátegui', 'Monagas', 'Sucre', 'Nueva Esparta', 'Bolívar', 'Delta Amacuro', 'Amazonas', 'Guárico', 'Apure'], 2600, 150000, '2-5 días hábiles'],
];
for (const z of ZONES) await q('INSERT INTO shipping_zones (name, states, cost, free_from, est_days) VALUES ($1,$2,$3,$4,$5)', z);

// ---------------- Categorías y marcas de repuestos ----------------
console.log('Categorías y marcas...');
const CATEGORIES = [
  ['Motor', 'engine', 'Empacaduras, bujías, correas, bombas y piezas internas.'],
  ['Frenos', 'brake', 'Pastillas, discos, bandas, líquido y cilindros.'],
  ['Suspensión', 'suspension', 'Amortiguadores, rótulas, terminales y bujes.'],
  ['Sistema eléctrico', 'bolt', 'Baterías, alternadores, arranques y sensores.'],
  ['Filtros', 'filter', 'Filtros de aceite, aire, gasolina y aire acondicionado.'],
  ['Aceites y lubricantes', 'oil', 'Aceites de motor, caja, refrigerantes y grasas.'],
  ['Carrocería', 'car', 'Retrovisores, parachoques, manillas y guardafangos.'],
  ['Iluminación', 'light', 'Faros, stops, bombillos y kits LED.'],
  ['Transmisión', 'gear', 'Kits de clutch, crucetas, tripoides y aceite de caja.'],
  ['Accesorios', 'star', 'Alfombras, cubreasientos, plumillas y herramientas.'],
];
const cat = {};
for (const [i, [name, icon, description]] of CATEGORIES.entries()) {
  cat[name] = (await one('INSERT INTO categories (name, slug, icon, description, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [name, slugify(name), icon, description, i])).id;
}
const BRANDS = ['Toyota Genuine', 'GM ACDelco', 'Motorcraft', 'Mobis', 'Bosch', 'Brembo', 'Monroe', 'Gates', 'NGK', 'Wix',
  'Castrol', 'Mobil', 'Valeo', 'Hella', 'Duncan', 'Philips', 'Exedy', 'Moog'];
const brand = {};
for (const b of BRANDS) brand[b] = (await one('INSERT INTO part_brands (name, slug) VALUES ($1,$2) RETURNING id', [b, slugify(b)])).id;

// ---------------- Vehículos: Marca → Modelo → Años → Motores ----------------
console.log('Catálogo de vehículos...');
const VEHICLES = {
  Toyota: {
    Corolla: [[2003, 2008, ['1.8L 1ZZ-FE Gasolina']], [2009, 2014, ['1.8L 2ZR-FE Gasolina']]],
    Hilux: [[2006, 2015, ['2.7L 2TR-FE Gasolina', '4.0L 1GR-FE V6 Gasolina']]],
    Fortuner: [[2006, 2015, ['2.7L 2TR-FE Gasolina', '4.0L 1GR-FE V6 Gasolina']]],
    Yaris: [[2006, 2013, ['1.3L 2NZ-FE Gasolina', '1.5L 1NZ-FE Gasolina']]],
  },
  Chevrolet: {
    Aveo: [[2006, 2013, ['1.6L DOHC Gasolina']]],
    Optra: [[2005, 2011, ['1.8L DOHC Gasolina']]],
    Spark: [[2005, 2012, ['1.0L SOHC Gasolina']]],
    Cruze: [[2011, 2016, ['1.8L Ecotec Gasolina']]],
  },
  Ford: {
    Fiesta: [[2004, 2013, ['1.6L Duratec Gasolina']]],
    Explorer: [[2006, 2010, ['4.0L V6 SOHC Gasolina']]],
    'F-150': [[2004, 2014, ['4.6L V8 Triton Gasolina', '5.4L V8 Triton Gasolina']]],
  },
  Hyundai: {
    Accent: [[2006, 2011, ['1.6L Alpha II Gasolina']]],
    Elantra: [[2007, 2010, ['2.0L Beta II Gasolina']], [2011, 2015, ['1.8L Nu Gasolina']]],
    Getz: [[2004, 2011, ['1.3L Alpha Gasolina', '1.6L Alpha Gasolina']]],
  },
  Mitsubishi: {
    Lancer: [[2009, 2015, ['2.0L 4B11 Gasolina']]],
    'Montero Sport': [[2010, 2015, ['3.0L V6 6B31 Gasolina']]],
  },
  Kia: {
    Rio: [[2006, 2011, ['1.6L Alpha II Gasolina']]],
    Sportage: [[2011, 2016, ['2.0L Theta II Gasolina']]],
  },
};
for (const [make, models] of Object.entries(VEHICLES)) {
  const mk = (await one('INSERT INTO vehicle_makes (name, slug) VALUES ($1,$2) RETURNING id', [make, slugify(make)])).id;
  for (const [model, ranges] of Object.entries(models)) {
    const md = (await one('INSERT INTO vehicle_models (make_id, name) VALUES ($1,$2) RETURNING id', [mk, model])).id;
    for (const [from, to, engines] of ranges) {
      for (let y = from; y <= to; y++) for (const e of engines) await q('INSERT INTO vehicles (model_id, year, engine) VALUES ($1,$2,$3)', [md, y, e]);
    }
  }
}

/** Devuelve IDs de vehículos: fit('Toyota', 'Corolla', 2009, 2014, '1.8L 2ZR-FE Gasolina'?) */
async function fit(make, model, from, to, engine) {
  const rows = await db.many(
    `SELECT v.id FROM vehicles v JOIN vehicle_models md ON md.id = v.model_id JOIN vehicle_makes mk ON mk.id = md.make_id
     WHERE mk.name = $1 AND md.name = $2 AND v.year BETWEEN $3 AND $4 AND ($5::text IS NULL OR v.engine = $5)`,
    [make, model, from, to, engine || null]
  );
  return rows.map((r) => r.id);
}

// ---------------- Productos ----------------
console.log('Productos y compatibilidad...');
// [sku, nombre, categoría, marca, original, usd_venta, margen, stock, mínimo, ubicación, garantía, oem, cód. fabricante, destacado, descripción, compatibilidad]
const PRODUCTS = [
  ['FRE-0001', 'Pastillas de freno delanteras cerámicas', 'Frenos', 'Brembo', false, 38, 0.38, 24, 6, 'A-01-2', 6, '04465-02220', 'P83085N', true,
    'Juego de 4 pastillas cerámicas de bajo polvo y bajo ruido. Incluye láminas antirruido y sensor acústico de desgaste.',
    [['Toyota', 'Corolla', 2009, 2014], ['Toyota', 'Yaris', 2006, 2013]]],
  ['FRE-0002', 'Disco de freno delantero ventilado', 'Frenos', 'Brembo', false, 46, 0.35, 14, 4, 'A-01-3', 6, '43512-02210', '09.A535.11', false,
    'Disco ventilado de hierro gris con tratamiento anticorrosión. Se vende por unidad; se recomienda cambiar en pares.',
    [['Toyota', 'Corolla', 2009, 2014]]],
  ['FRE-0003', 'Pastillas de freno delanteras semimetálicas', 'Frenos', 'Bosch', false, 29, 0.40, 30, 8, 'A-01-4', 6, '96534653', 'BP1023', true,
    'Pastillas semimetálicas QuietCast para uso urbano y carretera. Excelente desempeño en calor.',
    [['Chevrolet', 'Aveo', 2006, 2013], ['Chevrolet', 'Optra', 2005, 2011]]],
  ['FRE-0004', 'Líquido de frenos DOT 4 (500 ml)', 'Frenos', 'Bosch', false, 9, 0.45, 60, 15, 'A-02-1', 0, null, 'DOT4-500', false,
    'Líquido de frenos sintético DOT 4 de alto punto de ebullición. Compatible con sistemas ABS.', []],
  ['FRE-0005', 'Bandas de freno traseras', 'Frenos', 'Duncan', false, 24, 0.40, 3, 6, 'A-02-3', 6, '04495-0K120', 'DB-2290', false,
    'Juego de bandas (zapatas) para tambor trasero con remaches de acero.',
    [['Toyota', 'Hilux', 2006, 2015], ['Toyota', 'Fortuner', 2006, 2015]]],
  ['FIL-0001', 'Filtro de aceite original Toyota', 'Filtros', 'Toyota Genuine', true, 12, 0.42, 80, 20, 'B-01-1', 3, '90915-YZZE1', '90915-YZZE1', true,
    'Filtro de aceite original Toyota con válvula antirretorno. Cambio recomendado cada 5.000 km.',
    [['Toyota', 'Corolla', 2003, 2014], ['Toyota', 'Yaris', 2006, 2013], ['Toyota', 'Hilux', 2006, 2015, '2.7L 2TR-FE Gasolina'], ['Toyota', 'Fortuner', 2006, 2015, '2.7L 2TR-FE Gasolina']]],
  ['FIL-0002', 'Filtro de aire de motor', 'Filtros', 'Wix', false, 16, 0.40, 35, 10, 'B-01-2', 3, '17801-0D060', '49084', false,
    'Filtro de aire de papel plisado de alta retención. Mejora la respuesta del motor y el consumo.',
    [['Toyota', 'Corolla', 2009, 2014]]],
  ['FIL-0003', 'Filtro de aceite', 'Filtros', 'GM ACDelco', true, 10, 0.42, 55, 15, 'B-01-3', 3, '96879797', 'PF2257', false,
    'Filtro de aceite ACDelco original GM. Elemento filtrante de celulosa de alta capacidad.',
    [['Chevrolet', 'Aveo', 2006, 2013], ['Chevrolet', 'Optra', 2005, 2011], ['Chevrolet', 'Cruze', 2011, 2016]]],
  ['FIL-0004', 'Filtro de aire acondicionado (cabina) con carbón activado', 'Filtros', 'Bosch', false, 14, 0.45, 2, 5, 'B-02-1', 3, '87139-YZZ08', '0986BF0545', false,
    'Filtro de cabina con carbón activado: retiene polvo, polen y malos olores.',
    [['Toyota', 'Corolla', 2009, 2014], ['Toyota', 'Yaris', 2006, 2013]]],
  ['ACE-0001', 'Aceite de motor sintético 5W-30 (4 L)', 'Aceites y lubricantes', 'Mobil', false, 42, 0.30, 48, 12, 'C-01-1', 0, null, 'MOBIL1-5W30-4L', true,
    'Aceite 100% sintético API SP / ILSAC GF-6. Máxima protección contra el desgaste y depósitos.', []],
  ['ACE-0002', 'Aceite de motor semisintético 20W-50 (4 L)', 'Aceites y lubricantes', 'Castrol', false, 28, 0.32, 40, 12, 'C-01-2', 0, null, 'GTX-20W50-4L', false,
    'Aceite para motores con kilometraje alto y clima cálido. Ideal para Venezuela.', []],
  ['ACE-0003', 'Refrigerante concentrado (galón)', 'Aceites y lubricantes', 'Castrol', false, 18, 0.40, 26, 8, 'C-02-1', 0, null, 'RADICOOL-1G', false,
    'Refrigerante de larga duración con protección anticorrosiva. Mezclar 50/50 con agua desmineralizada.', []],
  ['MOT-0001', 'Juego de bujías de iridio (4 unidades)', 'Motor', 'NGK', false, 48, 0.36, 18, 5, 'D-01-1', 12, '90919-01253', 'ILKAR7B11', true,
    'Bujías de iridio Laser de larga vida (hasta 100.000 km). Arranque más rápido y combustión eficiente.',
    [['Toyota', 'Corolla', 2009, 2014], ['Toyota', 'Yaris', 2006, 2013]]],
  ['MOT-0002', 'Kit de correa de tiempo con tensor', 'Motor', 'Gates', false, 85, 0.35, 9, 3, 'D-01-3', 12, '24910-26000', 'TCK337', false,
    'Kit completo: correa de distribución, tensor y polea guía. Cambio recomendado cada 60.000 km.',
    [['Hyundai', 'Accent', 2006, 2011], ['Hyundai', 'Getz', 2004, 2011], ['Kia', 'Rio', 2006, 2011]]],
  ['MOT-0003', 'Bomba de agua', 'Motor', 'Gates', false, 62, 0.35, 7, 3, 'D-02-1', 12, '96930207', '42149', false,
    'Bomba de agua con empacadura incluida. Impulsor metálico para mayor durabilidad.',
    [['Chevrolet', 'Aveo', 2006, 2013], ['Chevrolet', 'Optra', 2005, 2011]]],
  ['MOT-0004', 'Empacadura de tapa de válvulas', 'Motor', 'Toyota Genuine', true, 26, 0.40, 1, 3, 'D-02-2', 6, '11213-22050', '11213-22050', false,
    'Empacadura original de goma con sellos de bujías. Evita fugas de aceite.',
    [['Toyota', 'Corolla', 2003, 2008]]],
  ['SUS-0001', 'Amortiguador delantero a gas (par)', 'Suspensión', 'Monroe', false, 120, 0.33, 10, 4, 'E-01-1', 12, '48510-09N80', 'G16359', true,
    'Par de amortiguadores delanteros OESpectrum a gas. Mejor control y confort en vías irregulares.',
    [['Toyota', 'Hilux', 2006, 2015], ['Toyota', 'Fortuner', 2006, 2015]]],
  ['SUS-0002', 'Rótula de suspensión inferior', 'Suspensión', 'Moog', false, 32, 0.38, 16, 5, 'E-01-3', 12, '43330-09510', 'K500202', false,
    'Rótula inferior con grasera y bota de poliuretano de larga vida.',
    [['Toyota', 'Hilux', 2006, 2015], ['Toyota', 'Fortuner', 2006, 2015]]],
  ['SUS-0003', 'Terminal de dirección exterior', 'Suspensión', 'Moog', false, 22, 0.40, 20, 6, 'E-02-1', 12, '56820-1G000', 'ES800901', false,
    'Terminal de dirección con tuerca y chaveta. Se vende por unidad.',
    [['Hyundai', 'Accent', 2006, 2011], ['Kia', 'Rio', 2006, 2011]]],
  ['ELE-0001', 'Batería 12V 75 Ah libre de mantenimiento', 'Sistema eléctrico', 'Bosch', false, 135, 0.28, 12, 4, 'F-01-1', 18, null, 'S4-34-75', true,
    'Batería sellada grupo 34, 750 CCA. Incluye instalación gratis en tienda.', []],
  ['ELE-0002', 'Alternador 90A remanufacturado', 'Sistema eléctrico', 'Valeo', false, 180, 0.30, 4, 2, 'F-01-3', 6, '23100-2Y00A', 'VA-439612', false,
    'Alternador remanufacturado y probado en banco. Se requiere entregar el alternador usado (casco).',
    [['Ford', 'Fiesta', 2004, 2013]]],
  ['ELE-0003', 'Sensor de oxígeno (sonda lambda)', 'Sistema eléctrico', 'Bosch', false, 58, 0.38, 8, 3, 'F-02-1', 6, '89465-02260', '0258986602', false,
    'Sonda lambda universal de 4 cables. Reduce consumo y emisiones.',
    [['Toyota', 'Corolla', 2009, 2014], ['Mitsubishi', 'Lancer', 2009, 2015]]],
  ['ILU-0001', 'Kit de bombillos LED H4 6000K', 'Iluminación', 'Philips', false, 45, 0.42, 22, 6, 'G-01-1', 12, null, '11342UE2X2', false,
    'Par de bombillos LED H4 alta/baja de 6000K. Instalación plug-and-play, sin modificaciones.', []],
  ['ILU-0002', 'Faro delantero izquierdo', 'Iluminación', 'Hella', false, 95, 0.35, 3, 2, 'G-02-1', 6, '81170-02B30', 'HL-2210L', false,
    'Faro completo lado conductor con regulador eléctrico. Lente de policarbonato con protección UV.',
    [['Toyota', 'Corolla', 2009, 2014]]],
  ['TRA-0001', 'Kit de clutch (embrague) completo', 'Transmisión', 'Exedy', false, 165, 0.32, 5, 2, 'H-01-1', 12, '31250-0K050', 'TYK-2185', true,
    'Kit de embrague con disco, plato y collarín. Alta resistencia para uso de carga.',
    [['Toyota', 'Hilux', 2006, 2015, '2.7L 2TR-FE Gasolina']]],
  ['TRA-0002', 'Aceite de caja automática ATF Dexron VI (1 L)', 'Transmisión', 'GM ACDelco', true, 14, 0.40, 36, 10, 'H-02-1', 0, '88863571', '10-9395', false,
    'Fluido de transmisión automática ATF Dexron VI de baja viscosidad.',
    [['Chevrolet', 'Cruze', 2011, 2016]]],
  ['CAR-0001', 'Retrovisor lateral derecho eléctrico', 'Carrocería', 'Valeo', false, 70, 0.38, 6, 2, 'I-01-1', 6, '87910-02D10', 'RV-3311R', false,
    'Retrovisor completo con ajuste eléctrico. Carcasa lista para pintar.',
    [['Toyota', 'Corolla', 2009, 2014]]],
  ['ACC-0001', 'Juego de alfombras de goma (4 piezas)', 'Accesorios', 'Bosch', false, 32, 0.45, 25, 6, 'J-01-1', 3, null, 'ALF-UNI-4', false,
    'Alfombras universales de goma con bordes altos, recortables. Fáciles de lavar.', []],
  ['ACC-0002', 'Plumillas limpiaparabrisas (par 22"/18")', 'Accesorios', 'Bosch', false, 22, 0.45, 40, 10, 'J-01-2', 3, null, 'AEROTWIN-2218', false,
    'Plumillas tipo Aerotwin sin estructura metálica. Barrido silencioso y uniforme.',
    [['Toyota', 'Corolla', 2009, 2014], ['Chevrolet', 'Aveo', 2006, 2013], ['Hyundai', 'Accent', 2006, 2011]]],
];

const products = [];
for (const [sku, name, catName, brandName, original, usd, margin, stock, min, loc, warranty, oem, mfr, featured, desc, compat] of PRODUCTS) {
  const price = Math.round((usd * RATE) / 10) * 10;                // Bs. redondeado a la decena
  const cost = money(price * (1 - margin));
  const p = await one(
    `INSERT INTO products (sku, oem_number, manufacturer_code, name, slug, description, category_id, brand_id, is_original,
       cost_price, price, price_workshop, price_wholesale, stock, min_stock, warehouse_location, warranty_months, featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14,$15,$16,$17) RETURNING id, price, cost_price`,
    [sku, oem, mfr, `${name} ${brandName}`, slugify(`${name} ${brandName} ${sku}`), desc, cat[catName], brand[brandName], original,
     cost, price, featured ? money(price * 0.88) : null, null, min, loc, warranty, featured]
  );
  // stock inicial alto: luego las ventas de ejemplo lo bajan hasta el valor deseado
  products.push({ ...p, sku, name: `${name} ${brandName}`, targetStock: stock });
  for (const [make, model, from, to, engine] of compat) {
    for (const vid of await fit(make, model, from, to, engine)) {
      await q('INSERT INTO product_vehicles (product_id, vehicle_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [p.id, vid]);
    }
  }
}

// ---------------- Usuarios ----------------
console.log('Usuarios...');
const hash = (pw) => bcrypt.hash(pw, 10);
const admin = await one(`INSERT INTO users (name, email, password_hash, role, phone) VALUES ('Administrador MACAI', 'admin@macai.com', $1, 'admin', '0414-1234567') RETURNING id`, [await hash('Admin1234')]);
await q(`INSERT INTO users (name, email, password_hash, role, permissions) VALUES ('Carlos Ventas', 'ventas@macai.com', $1, 'empleado', $2)`,
  [await hash('Ventas1234'), ['dashboard', 'pedidos', 'clientes', 'productos']]);
await q(`INSERT INTO users (name, email, password_hash, role, permissions) VALUES ('Luis Almacén', 'almacen@macai.com', $1, 'empleado', $2)`,
  [await hash('Almacen1234'), ['inventario', 'productos', 'proveedores', 'compatibilidad']]);
const CUSTOMERS = [
  ['María González', 'cliente@macai.com', 'normal', 'V-18456789', '0414-5551234', 'Miranda', 'Los Teques', 'Urb. El Paso, calle 3, casa 12'],
  ['Taller El Pistón', 'taller@macai.com', 'taller', 'J-40876543-2', '0212-5559876', 'Distrito Capital', 'Caracas', 'Av. San Martín, local 4, frente a la Plaza Capuchinos'],
  ['Repuestos del Centro, C.A.', 'mayorista@macai.com', 'mayorista', 'J-31234567-8', '0241-5554321', 'Carabobo', 'Valencia', 'Zona Industrial Norte, galpón 22'],
  ['José Rodríguez', 'jose@correo.com', 'normal', 'V-20111222', '0424-1112233', 'Zulia', 'Maracaibo', 'Av. 5 de Julio con calle 77, edif. Lago, apto 4B'],
  ['Andreína Pérez', 'andreina@correo.com', 'normal', 'V-22333444', '0412-9998877', 'Lara', 'Barquisimeto', 'Urb. Del Este, carrera 19, casa 8'],
  ['Autoservicio La Curva', 'lacurva@correo.com', 'taller', 'J-29988776-1', '0281-5556677', 'Anzoátegui', 'Barcelona', 'Av. Intercomunal, sector La Curva'],
];
const customers = [];
for (const [name, email, type, doc, phone, state, city, line] of CUSTOMERS) {
  const u = await one('INSERT INTO users (name, email, password_hash, customer_type, doc_id, phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [name, email, await hash('Cliente1234'), type, doc, phone]);
  await q('INSERT INTO addresses (user_id, recipient, phone, state, city, line, is_default) VALUES ($1,$2,$3,$4,$5,$6,TRUE)', [u.id, name, phone, state, city, line]);
  customers.push({ id: u.id, name, email, type, doc, phone, address: { recipient: name, phone, state, city, line } });
}
// Vehículo guardado de la clienta demo: Corolla 2012
const corolla = (await fit('Toyota', 'Corolla', 2012, 2012))[0];
await q('INSERT INTO saved_vehicles (user_id, vehicle_id, nickname) VALUES ($1,$2,$3)', [customers[0].id, corolla, 'Mi Corolla']);

// ---------------- Proveedores y una orden de compra ----------------
console.log('Proveedores...');
const SUPPLIERS = [
  ['Importadora Autopartes Andes, C.A.', 'J-30567890-1', 'Ricardo Méndez', '0212-5551010', 'compras@autoandes.com.ve', 'Zona Industrial La Yaguara, Caracas'],
  ['Distribuidora Frenos y Más', 'J-41234098-3', 'Gabriela Torres', '0241-5552020', 'ventas@frenosymas.com.ve', 'Av. Bolívar Norte, Valencia'],
  ['Lubricantes del Lago', 'J-29876123-0', 'Pedro Urdaneta', '0261-5553030', 'pedidos@lublago.com.ve', 'Av. 16 Guajira, Maracaibo'],
];
const sup = [];
for (const s of SUPPLIERS) sup.push((await one('INSERT INTO suppliers (name, rif, contact, phone, email, address) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', s)).id);

// ---------------- Promociones y cupones ----------------
console.log('Promociones y cupones...');
await q(`INSERT INTO coupons (code, type, value, min_order, max_uses, ends_at) VALUES ('BIENVENIDO10', 'percent', 10, 0, 500, NOW() + INTERVAL '60 days')`);
await q(`INSERT INTO coupons (code, type, value, min_order, ends_at) VALUES ('TALLER2000', 'fixed', 2000, 30000, NOW() + INTERVAL '30 days')`);
await q(`INSERT INTO coupons (code, type, value, min_order, ends_at, active) VALUES ('VERANO2026', 'percent', 15, 0, NOW() - INTERVAL '5 days', TRUE)`);
await q(`INSERT INTO promotions (name, scope, category_id, percent, starts_at, ends_at, banner)
         VALUES ('Semana del freno', 'category', $1, 15, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', TRUE)`, [cat['Frenos']]);
await q(`INSERT INTO promotions (name, scope, product_id, percent, starts_at, ends_at, banner)
         VALUES ('Oferta flash: aceite sintético', 'product', $1, 20, NOW() - INTERVAL '2 hours', NOW() + INTERVAL '3 days', TRUE)`,
  [products.find((p) => p.sku === 'ACE-0001').id]);

// ---------------- Stock inicial y pedidos históricos ----------------
console.log('Stock inicial y pedidos de ejemplo...');
// Generador pseudoaleatorio con semilla fija: los datos de demo son siempre los mismos
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// Se decide primero cuánto vende cada producto para que el stock final sea el deseado
const plan = [];
for (let i = 0; i < 64; i++) {
  const daysAgo = Math.floor(Math.pow(rand(), 1.4) * 45);
  const lines = [];
  const n = 1 + Math.floor(rand() * 3);
  for (let j = 0; j < n; j++) {
    const p = pick(products);
    if (!lines.find((l) => l.p === p)) lines.push({ p, qty: 1 + Math.floor(rand() * (p.price < 10000 ? 4 : 2)) });
  }
  plan.push({ daysAgo, lines, customer: pick(customers) });
}
const soldBy = new Map();
for (const o of plan) for (const l of o.lines) soldBy.set(l.p.id, (soldBy.get(l.p.id) || 0) + l.qty);

for (const p of products) {
  const initial = p.targetStock + (soldBy.get(p.id) || 0);
  await q('UPDATE products SET stock = $1 WHERE id = $2', [initial, p.id]);
  await q(`INSERT INTO inventory_movements (product_id, type, quantity, stock_after, reason, reference, user_id, created_at)
           VALUES ($1, 'compra', $2, $2, 'Inventario inicial', 'OC-INICIAL', $3, NOW() - INTERVAL '50 days')`, [p.id, initial, admin.id]);
  p.stock = initial;
}

const zones = await db.many('SELECT * FROM shipping_zones ORDER BY id');
const zoneFor = (state) => zones.find((z) => z.states.includes(state)) || zones[0];
plan.sort((a, b) => b.daysAgo - a.daysAgo);
for (const o of plan) {
  const c = o.customer;
  const delivery = rand() < 0.3 ? 'retiro' : 'envio';
  const zone = delivery === 'envio' ? zoneFor(c.address.state) : null;
  const factor = c.type === 'taller' ? 0.9 : c.type === 'mayorista' ? 0.82 : 1;
  const items = o.lines.map(({ p, qty }) => ({ p, qty, unit: money(p.price * factor) }));
  const subtotal = money(items.reduce((s, it) => s + it.unit * it.qty, 0));
  const shipping = zone ? (subtotal >= zone.free_from ? 0 : zone.cost) : 0;
  const tax = money(subtotal * 0.16);
  const total = money(subtotal + tax + shipping);
  // Estado según antigüedad: lo viejo está entregado; lo reciente, en proceso
  const status = o.daysAgo > 6 ? (rand() < 0.08 ? 'cancelado' : 'entregado')
    : pick(['pendiente', 'pagado', 'preparacion', 'enviado', 'entregado']);
  const pm = delivery === 'retiro' ? pick(['pago_movil', 'tarjeta', 'transferencia']) : pick(['pago_movil', 'transferencia', 'zelle', 'contra_entrega']);
  const ref = ['pago_movil', 'transferencia', 'zelle'].includes(pm) ? String(Math.floor(100000 + rand() * 899999)) : null;
  const when = `NOW() - INTERVAL '${o.daysAgo} days' - INTERVAL '${Math.floor(rand() * 9)} hours'`;
  const ord = await one(
    `INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, customer_doc, customer_type, delivery_type,
       shipping_zone_id, shipping_address, payment_method, payment_reference, status, subtotal, shipping_cost, tax, total,
       carrier, tracking_number, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, ${when}, ${when}) RETURNING id, created_at`,
    [c.id, c.name, c.email, c.phone, c.doc, c.type, delivery, zone?.id || null, zone ? JSON.stringify(c.address) : null, pm, ref,
     status, subtotal, shipping, tax, total,
     zone && ['enviado', 'entregado'].includes(status) ? (zone.id === zones[0].id ? 'Delivery MACAI' : 'MRW') : null,
     zone && ['enviado', 'entregado'].includes(status) ? String(Math.floor(1e9 + rand() * 8e9)) : null]
  );
  const oc = code('MAC', ord.id);
  await q('UPDATE orders SET code = $1 WHERE id = $2', [oc, ord.id]);
  for (const it of items) {
    await q(`INSERT INTO order_items (order_id, product_id, name, sku, quantity, unit_price, unit_cost, total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ord.id, it.p.id, it.p.name, it.p.sku, it.qty, it.unit, it.p.cost_price, money(it.unit * it.qty)]);
    if (status !== 'cancelado') {
      it.p.stock -= it.qty;
      await q(`INSERT INTO inventory_movements (product_id, type, quantity, stock_after, reason, reference, created_at)
               VALUES ($1, 'venta', $2, $3, 'Venta en tienda en línea', $4, ${when})`, [it.p.id, -it.qty, it.p.stock, oc]);
    }
  }
  // Historial de estados coherente con el estado final
  const flow = ['pendiente', 'pagado', 'preparacion', delivery === 'envio' ? 'enviado' : null, 'entregado'].filter(Boolean);
  const steps = status === 'cancelado' ? ['pendiente', 'cancelado'] : flow.slice(0, flow.indexOf(status) + 1);
  for (const [k, s] of steps.entries()) {
    await q(`INSERT INTO order_status_history (order_id, status, note, user_id, created_at) VALUES ($1,$2,$3,$4, $5::timestamptz + INTERVAL '${k * 5} hours')`,
      [ord.id, s, s === 'pendiente' ? 'Pedido recibido' : null, s === 'pendiente' ? c.id : admin.id, ord.created_at]);
  }
}
// Stock final y unidades vendidas (los cancelados devuelven el stock)
for (const p of products) {
  await q(`UPDATE products SET stock = $1, sold_count = (SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE oi.product_id = $2 AND o.status <> 'cancelado') WHERE id = $2`, [p.stock, p.id]);
}

// Una orden de compra recibida y otra en borrador para stock bajo
const low = products.filter((p) => p.targetStock <= 3);
const po = await one(`INSERT INTO purchase_orders (supplier_id, status, notes, created_by) VALUES ($1, 'borrador', 'Reposición de productos con stock bajo', $2) RETURNING id`, [sup[0], admin.id]);
let poTotal = 0;
for (const p of low) {
  await q('INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_cost) VALUES ($1,$2,$3,$4)', [po.id, p.id, 10, p.cost_price]);
  poTotal += 10 * p.cost_price;
}
await q('UPDATE purchase_orders SET code = $1, total = $2 WHERE id = $3', [code('OC', po.id), money(poTotal), po.id]);

// ---------------- Reseñas ----------------
const REVIEWS = [
  ['FRE-0001', 0, 5, 'Frenan muy bien y no hacen ruido. Le quedaron perfectas a mi Corolla 2012.'],
  ['FRE-0001', 1, 4, 'Buena calidad para el precio. Las montamos en varios Corolla del taller.'],
  ['FIL-0001', 0, 5, 'Original de verdad, llegó en caja sellada.'],
  ['ACE-0001', 3, 5, 'El motor se siente más suave. Entrega rápida a Maracaibo.'],
  ['SUS-0001', 5, 4, 'Muy buenos para la Hilux, se nota en los huecos.'],
  ['ELE-0001', 4, 5, 'Me la instalaron gratis en la tienda. Excelente atención.'],
  ['MOT-0001', 1, 5, 'Las de iridio NGK nunca fallan.'],
];
for (const [sku, ci, rating, comment] of REVIEWS) {
  await q('INSERT INTO reviews (product_id, user_id, rating, comment, created_at) VALUES ($1,$2,$3,$4, NOW() - INTERVAL \'5 days\')',
    [products.find((p) => p.sku === sku).id, customers[ci].id, rating, comment]);
}

console.log(`\nListo: ${products.length} productos, ${Object.keys(VEHICLES).length} marcas de vehículos, ${plan.length} pedidos.`);
console.log('Usuarios de prueba:');
console.log('  admin@macai.com / Admin1234        (administrador)');
console.log('  ventas@macai.com / Ventas1234      (empleado: dashboard, pedidos, clientes, productos)');
console.log('  almacen@macai.com / Almacen1234    (empleado: inventario, productos, proveedores, compatibilidad)');
console.log('  cliente@macai.com / Cliente1234    (cliente normal, con Corolla 2012 guardado)');
console.log('  taller@macai.com / Cliente1234     (cliente taller)');
console.log('  mayorista@macai.com / Cliente1234  (cliente mayorista)');
process.exit(0);
