# MACAI Autopartes

Tienda virtual de repuestos y autopartes para Venezuela (precios en bolívares), con **tienda pública** y **panel administrativo**.

- **Frontend:** React 19 + Vite + Tailwind CSS 4 + React Router 7 + Recharts. Diseñado primero para móvil, con modo claro y oscuro.
- **Backend:** Node.js (Express 5), API REST con autenticación JWT y roles.
- **Base de datos:** PostgreSQL. Funciona igual con un servidor propio, con **Supabase** o, para la demo, con **PGlite**: PostgreSQL embebido que no requiere instalar nada.

---

## 1. Estructura del proyecto

```
macai-autopartes/
├── backend/
│   ├── src/
│   │   ├── server.js              # Punto de entrada: Express, seguridad, rutas, SPA en producción
│   │   ├── config.js              # Variables de entorno
│   │   ├── paths.js               # Carpetas de subidas y del frontend compilado
│   │   ├── db/
│   │   │   ├── schema.sql         # Esquema completo de PostgreSQL
│   │   │   ├── index.js           # Conexión: pg (Postgres/Supabase) o PGlite (demo)
│   │   │   └── seed.js            # Datos de ejemplo
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT, roles y permisos por módulo
│   │   │   └── validate.js        # Validación de formularios (cédula/RIF, teléfono VE, etc.)
│   │   ├── services/
│   │   │   ├── catalog.js         # Búsqueda: texto, OEM, compatibilidad, filtros, facetas
│   │   │   ├── pricing.js         # Precios por tipo de cliente, promociones, cupones, IVA, envío
│   │   │   ├── orders.js          # Creación de pedidos, estados, movimientos de stock
│   │   │   ├── invoice.js         # Comprobante PDF
│   │   │   └── settings.js        # Configuración de la tienda
│   │   ├── routes/
│   │   │   ├── auth.js            # Registro, login, perfil
│   │   │   ├── catalog.js         # Categorías, marcas, vehículos, productos, reseñas
│   │   │   ├── account.js         # Direcciones, garaje, lista de deseos, mis pedidos
│   │   │   ├── orders.js          # Cotización del carrito, checkout, comprobante
│   │   │   ├── seo.js             # sitemap.xml y robots.txt
│   │   │   └── admin/             # Un archivo por módulo del panel
│   │   └── utils/                 # Errores, helpers, generador de CRUD
│   └── uploads/                   # Fotos de productos subidas desde el panel
└── frontend/
    └── src/
        ├── App.jsx                # Rutas
        ├── context/AppContext.jsx # Sesión, carrito, tema, vehículo seleccionado, avisos
        ├── lib/                   # Cliente de la API y formatos (Bs., fechas, estados)
        ├── components/            # Layout, buscador por vehículo, tarjetas, UI, SEO
        ├── pages/                 # Tienda pública y cuenta del cliente
        └── admin/                 # Panel administrativo
```

## 2. Esquema de la base de datos

El archivo completo está en [`backend/src/db/schema.sql`](../backend/src/db/schema.sql).

| Área | Tablas | Notas |
|---|---|---|
| Usuarios | `users`, `addresses` | `role`: cliente / empleado / admin. `customer_type`: normal / taller / mayorista. `permissions[]` define los módulos que ve cada empleado. Contraseñas con bcrypt. |
| Compatibilidad | `vehicle_makes` → `vehicle_models` → `vehicles` | Cada fila de `vehicles` es una combinación **modelo + año + motor**. |
| Catálogo | `categories`, `part_brands`, `products`, `product_vehicles` | El producto guarda SKU, OEM, código del fabricante, costo, precio normal, precio taller y precio mayorista (opcionales), stock, stock mínimo, ubicación en bodega, fotos (JSON) y garantía. `product_vehicles` lo relaciona con los vehículos compatibles. |
| Cliente | `reviews`, `wishlist`, `saved_vehicles` | Reseñas con marca de "compra verificada", lista de deseos y "Mi garaje". |
| Promociones | `coupons`, `promotions` | Cupones por % o monto fijo, con compra mínima, usos y vigencia. Descuentos por categoría o producto con fecha de fin (ofertas por tiempo limitado). |
| Ventas | `orders`, `order_items`, `order_status_history` | Cada línea guarda precio **y costo** del momento, para calcular la utilidad real. Historial de estados para el seguimiento. |
| Inventario | `inventory_movements` | Entrada, salida, ajuste, venta, devolución y compra, con el stock resultante. |
| Compras | `suppliers`, `purchase_orders`, `purchase_order_items` | Al recibir una orden entra el stock y se actualiza el costo. |
| Configuración | `settings`, `shipping_zones`, `payment_methods` | Datos de la tienda, IVA, descuentos por tipo de cliente, zonas por estado y métodos de pago. |

### Reglas de negocio importantes
- **El precio siempre se calcula en el servidor** (`services/pricing.js`). El carrito y el pedido usan el mismo cálculo, así que el total cotizado es el cobrado.
- Precio final = el menor entre el **precio del tipo de cliente** y el **precio en promoción**. Los descuentos no se acumulan; el cupón se aplica después.
- Los precios del catálogo no incluyen IVA. El IVA (16 %, configurable) se suma en el checkout.
- Al crear un pedido se descuenta el stock dentro de una transacción con bloqueo de filas. Si el pedido se cancela, el stock vuelve al inventario.
- Los estados siguen un flujo válido: pendiente → pagado → en preparación → enviado → entregado, o cancelado. Para marcarlo como "enviado" se exige el número de guía.
- Un producto con ventas no se borra: se desactiva, para no perder el historial.

## 3. Funcionalidades

**Tienda pública**
- Inicio con banners de ofertas y cuenta regresiva, categorías, más vendidos, marcas de vehículos y recomendados.
- Buscador por compatibilidad Marca → Modelo → Año → Motor, con opción "Guardar en mi garaje".
- Búsqueda por texto (sin importar acentos), por número OEM o por código del fabricante (sin importar guiones). Autocompletado en el header.
- 10 categorías y filtros por precio, marca del repuesto, original/genérico y disponibilidad. Los filtros quedan en la URL, así que se pueden compartir.
- Ficha de producto: fotos, número de parte, tabla de vehículos compatibles agrupada por años, aviso de si sirve para "tu vehículo", stock, garantía, reseñas y productos relacionados.
- Carrito y checkout: datos con cédula/RIF, envío a domicilio (zona elegida automáticamente según el estado) o retiro en tienda, cupones, IVA y métodos de pago venezolanos (Pago Móvil, transferencia, Zelle, punto de venta y pago contra entrega). El número de referencia es obligatorio cuando corresponde.
- Mi cuenta: pedidos con línea de tiempo y número de guía, comprobante PDF, garaje, direcciones, lista de deseos y perfil.
- Botón flotante de WhatsApp: en la ficha de producto el mensaje incluye el enlace del repuesto.
- Páginas Sobre nosotros, Contacto y Garantía y devoluciones.
- SEO: `<title>` y `meta description` por página, Open Graph, URL canónica, datos estructurados `schema.org/Product` (precio, stock y reseñas), `sitemap.xml` y `robots.txt`.

**Panel administrativo** (cada módulo protegido por permiso)
1. **Dashboard:** ventas de hoy, la semana y el mes (con variación frente al mes anterior), pedidos por atender, gráficos de ingresos y utilidad de 30 días, ventas por categoría, más vendidos, stock bajo y pedidos recientes.
2. **Productos:** crear, editar y eliminar; subir fotos; asignar compatibilidad por rango de años y motor; importar y exportar en Excel o CSV.
3. **Compatibilidad:** catálogo de marcas, modelos, años y motores. Se pueden crear años en lote.
4. **Inventario:** entradas, salidas, ajustes por conteo, historial con filtros y alertas de stock bajo con cantidad sugerida a pedir.
5. **Pedidos:** filtros por estado, entrega, fecha y búsqueda; cambio de estado con nota y guía; utilidad del pedido; comprobante PDF; enlace a WhatsApp del cliente.
6. **Clientes:** listado con total comprado, historial, vehículos y tipo de cliente (normal, taller o mayorista) con precios diferenciados.
7. **Proveedores y órdenes de compra:** borrador → enviada → recibida (suma el stock y actualiza el costo).
8. **Promociones:** cupones y descuentos por categoría o producto con vigencia; opción de mostrarlos en el banner.
9. **Reportes:** ventas, utilidad por producto e inventario valorizado, exportables a **PDF y Excel**.
10. **Usuarios y permisos:** crear empleados y marcar qué módulos pueden ver.
11. **Configuración:** datos de la tienda, IVA, descuentos por tipo de cliente, retiro en tienda, métodos de pago, zonas y costos de envío, categorías y marcas.

**Seguridad:** contraseñas con bcrypt; JWT; protección de rutas por rol y módulo, tanto en la API como en el frontend; límite de intentos de login; el costo de los productos nunca se envía a los clientes; validación de datos en el navegador y en el servidor; consultas parametrizadas; cabeceras de seguridad; subida de imágenes limitada por tipo y tamaño.

## 4. Instalación y ejecución

### Requisitos
- Node.js 20 o superior (probado con Node 24).
- **Opcional:** PostgreSQL 14+ o un proyecto de Supabase. Sin ellos, se usa PGlite automáticamente.

### Pasos (modo demo, sin instalar PostgreSQL)
```bash
# 1) Backend
cd backend
npm install
cp .env.example .env        # en Windows: copy .env.example .env  → luego cambia JWT_SECRET
npm run seed                # crea las tablas y carga los datos de ejemplo
npm run dev                 # API en http://localhost:4600

# 2) Frontend (en otra terminal)
cd frontend
npm install
npm run dev                 # tienda en http://localhost:5180
```

Abre **http://localhost:5180**. El panel está en **/admin**.

### Usar PostgreSQL o Supabase
1. Crea la base de datos (o el proyecto en Supabase).
2. En `backend/.env` define `DATABASE_URL`, por ejemplo:
   - Local: `postgresql://postgres:clave@localhost:5432/macai`
   - Supabase: *Project Settings → Database → Connection string (URI)*
3. Ejecuta `npm run seed`. Las tablas se crean solas desde `schema.sql`; también puedes pegar ese archivo en el editor SQL de Supabase.

### Volver a cargar los datos de ejemplo
```bash
cd backend
npm run seed -- --reset     # ¡BORRA todos los datos y vuelve a cargar la demo!
```

### Producción (un solo servidor)
```bash
cd frontend && npm run build    # genera frontend/dist
cd ../backend && npm start      # la API sirve también la tienda en http://localhost:4600
```
Pon `PUBLIC_URL` con tu dominio (para CORS y el sitemap) y un `JWT_SECRET` largo y aleatorio.

## 5. Datos de ejemplo

`npm run seed` carga:
- **6 marcas de vehículos** (Toyota, Chevrolet, Ford, Hyundai, Mitsubishi y Kia) con 18 modelos y sus años y motores.
- **29 productos** en 10 categorías, con compatibilidad, números OEM, precios en Bs., stock y 3 productos con stock bajo.
- 64 pedidos de los últimos 45 días en distintos estados, reseñas, 3 proveedores, 1 orden de compra, 3 cupones (`BIENVENIDO10`, `TALLER2000` y `VERANO2026`, este último vencido) y 2 ofertas activas.
- 4 zonas de envío y 5 métodos de pago.

| Usuario | Contraseña | Rol |
|---|---|---|
| admin@macai.com | Admin1234 | Administrador |
| ventas@macai.com | Ventas1234 | Empleado: dashboard, pedidos, clientes y productos |
| almacen@macai.com | Almacen1234 | Empleado: inventario, productos, proveedores y compatibilidad |
| cliente@macai.com | Cliente1234 | Cliente normal (tiene un Corolla 2012 guardado) |
| taller@macai.com | Cliente1234 | Cliente taller (precios de taller) |
| mayorista@macai.com | Cliente1234 | Cliente mayorista |

> Los números OEM, precios, datos bancarios y cifras de la tienda son **ilustrativos** para la demo. Edítalos desde el panel antes de usar la tienda con clientes reales.

## 6. Notas para Venezuela
- Moneda: bolívares (`Bs. 1.234,56`), hora de Caracas en reportes y dashboard.
- El comprobante PDF es **no fiscal**. La factura fiscal debe emitirse con máquina fiscal o imprenta autorizada por el SENIAT.
- Las zonas de envío se asignan por estado. Las empresas de envío del panel son Delivery propio, MRW, Zoom, Tealca y Domesa.
- Validaciones de cédula/RIF (`V-12345678`, `J-40123456-7`) y teléfonos (`0414-1234567`).

## 7. Importar productos desde Excel/CSV
Exporta primero desde el panel para obtener la plantilla. Columnas obligatorias: **SKU, Nombre, Precio y Categoría**.
- Si el SKU ya existe, el producto se actualiza; si no, se crea.
- La marca se crea automáticamente si no existe.
- Si cambia el stock, se registra como un ajuste de inventario.
- Compatibilidad: `Toyota/Corolla/2009-2014/1.8L 2ZR-FE Gasolina; Toyota/Yaris/2006-2013`. El motor es opcional.
- Al terminar se muestra un resumen con el número de fila de cada error.
