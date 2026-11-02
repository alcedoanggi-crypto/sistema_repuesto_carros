<div align="center">

<img src="docs/capturas/portada.png" alt="MACAI — Tienda virtual de repuestos y panel de gestión" width="100%" />

# MACAI Autopartes

### Tienda virtual de repuestos para carros + panel de gestión completo

*La pieza exacta para tu carro, sin adivinar.*

![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase_ready-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

[Demo en video](#-demo) · [Funcionalidades](#-qué-resuelve) · [Capturas](#-capturas) · [Arquitectura](#-arquitectura) · [Instalación](#-instalación-rápida) · [Documentación técnica](docs/DOCUMENTACION.md)

</div>

---

## 🎯 El problema

Comprar repuestos suele ser una adivinanza: *"¿le sirve a mi Corolla 2012?"*. El cliente pregunta por WhatsApp, el vendedor revisa catálogos en papel y, muchas veces, la pieza llega y no encaja.

**MACAI** resuelve esto con un catálogo donde **cada repuesto está asociado a los vehículos en los que funciona** (marca, modelo, año y motor). Además, la tienda tiene detrás un panel para gestionar inventario, pedidos, clientes, proveedores y reportes.

Pensado para **Venezuela**: precios en **bolívares**, IVA, validación de **cédula/RIF**, zonas de envío por estado (MRW, Zoom, Tealca) y métodos de pago locales (**Pago Móvil**, transferencia, Zelle y punto de venta).

## 🎬 Demo

<div align="center">
<img src="docs/capturas/demo.gif" alt="Recorrido por la tienda y el panel" width="90%" />
</div>

## ✨ Qué resuelve

<table>
<tr>
<td width="50%" valign="top">

### 🛒 Tienda pública
- 🚗 **Buscador por compatibilidad:** Marca → Modelo → Año → Motor, con "Guardar en mi garaje".
- 🔎 **Búsqueda por número OEM** o código del fabricante, sin importar guiones ni acentos.
- 🧰 10 categorías y filtros por precio, marca, original/genérico y stock.
- 📄 Ficha de producto con **tabla de vehículos compatibles**, garantía, reseñas y productos relacionados.
- 🏷️ Ofertas con **cuenta regresiva** y cupones de descuento.
- 💳 Checkout con envío por zona o **retiro en tienda** y pagos venezolanos.
- 📦 Seguimiento del pedido con **línea de tiempo** y comprobante PDF.
- 💬 Botón flotante de **WhatsApp** con el enlace del repuesto.
- 🌗 **Modo claro/oscuro** y diseño **mobile first**.
- 🔍 SEO: metadatos, `schema.org/Product`, sitemap y robots.

</td>
<td width="50%" valign="top">

### 🛠️ Panel administrativo
- 📊 **Dashboard:** ventas del día, la semana y el mes, ingresos y utilidad de 30 días, stock bajo y top de ventas.
- 📦 **Productos:** CRUD, fotos y **importación/exportación Excel/CSV**.
- 🚙 **Compatibilidad:** catálogo de marcas, modelos, años y motores.
- 🏬 **Inventario:** entradas, salidas, ajustes, historial y alertas.
- 🧾 **Pedidos:** filtros, flujo de estados, guía de envío y comprobante.
- 👥 **Clientes:** normal, taller o mayorista, con **precios diferenciados**.
- 🚚 **Proveedores:** al recibir una orden de compra entra el stock.
- 🎟️ **Promociones:** cupones y descuentos con vigencia.
- 📈 **Reportes:** ventas, utilidad e inventario valorizado en **PDF y Excel**.
- 🔐 **Usuarios y permisos** por módulo.

</td>
</tr>
</table>

## 📸 Capturas

### Tienda

| Inicio | Buscador por compatibilidad |
|:--:|:--:|
| <img src="docs/capturas/01-inicio.png" alt="Inicio" /> | <img src="docs/capturas/02-buscador-compatibilidad.png" alt="Buscador por vehículo" /> |
| **Solo repuestos compatibles** | **Búsqueda por número OEM** |
| <img src="docs/capturas/03-catalogo-compatible.png" alt="Catálogo filtrado por vehículo" /> | <img src="docs/capturas/04-busqueda-oem.png" alt="Autocompletado por OEM" /> |
| **Ficha de producto** | **Tabla de compatibilidad y reseñas** |
| <img src="docs/capturas/05-ficha-producto.png" alt="Ficha de producto" /> | <img src="docs/capturas/06-tabla-compatibilidad.png" alt="Tabla de compatibilidad" /> |
| **Carrito con cupón** | **Checkout con Pago Móvil** |
| <img src="docs/capturas/07-carrito-cupon.png" alt="Carrito" /> | <img src="docs/capturas/08-checkout.png" alt="Checkout" /> |
| **Seguimiento del pedido** | **Mi garaje** |
| <img src="docs/capturas/09-pedido-seguimiento.png" alt="Seguimiento" /> | <img src="docs/capturas/10-mi-garaje.png" alt="Mi garaje" /> |

<div align="center">

**Modo oscuro** · **Versión móvil**

<img src="docs/capturas/11-tienda-modo-oscuro.png" alt="Modo oscuro" width="49%" /> <img src="docs/capturas/22-version-movil.png" alt="Versión móvil" width="49%" />

</div>

### Panel administrativo

| Dashboard | Dashboard en modo oscuro |
|:--:|:--:|
| <img src="docs/capturas/12-dashboard.png" alt="Dashboard" /> | <img src="docs/capturas/21-dashboard-modo-oscuro.png" alt="Dashboard oscuro" /> |
| **Pedidos** | **Detalle y flujo del pedido** |
| <img src="docs/capturas/13-pedidos.png" alt="Pedidos" /> | <img src="docs/capturas/14-detalle-pedido.png" alt="Detalle de pedido" /> |
| **Productos e importación Excel/CSV** | **Edición de producto** |
| <img src="docs/capturas/15-productos.png" alt="Productos" /> | <img src="docs/capturas/16-editar-producto.png" alt="Editar producto" /> |
| **Catálogo de compatibilidad** | **Alertas de stock bajo** |
| <img src="docs/capturas/17-compatibilidad.png" alt="Compatibilidad" /> | <img src="docs/capturas/18-inventario-stock-bajo.png" alt="Inventario" /> |
| **Reportes en PDF y Excel** | **Usuarios y permisos por módulo** |
| <img src="docs/capturas/19-reportes.png" alt="Reportes" /> | <img src="docs/capturas/20-usuarios-permisos.png" alt="Permisos" /> |

## 🧭 Arquitectura

```mermaid
flowchart LR
    subgraph Cliente["🖥️ Navegador"]
        T["Tienda pública<br/>React + Tailwind"]
        P["Panel administrativo<br/>rutas protegidas por rol"]
    end
    subgraph API["⚙️ API REST — Node.js / Express"]
        A["Auth JWT<br/>roles + permisos"]
        C["Catálogo y<br/>compatibilidad"]
        PR["Motor de precios<br/>tipo de cliente · promos · cupón · IVA"]
        O["Pedidos e<br/>inventario (transacciones)"]
        R["Reportes<br/>PDF · Excel"]
    end
    DB[("🐘 PostgreSQL<br/>Supabase / PGlite")]
    T -- /api --> A & C & PR & O
    P -- /api/admin --> A & O & R
    C & PR & O & R --> DB
```

### Modelo de datos (resumen)

```mermaid
erDiagram
    VEHICLE_MAKES ||--o{ VEHICLE_MODELS : tiene
    VEHICLE_MODELS ||--o{ VEHICLES : "año + motor"
    PRODUCTS }o--o{ VEHICLES : "product_vehicles (compatibilidad)"
    CATEGORIES ||--o{ PRODUCTS : agrupa
    PART_BRANDS ||--o{ PRODUCTS : fabrica
    USERS ||--o{ ORDERS : realiza
    ORDERS ||--|{ ORDER_ITEMS : contiene
    ORDERS ||--o{ ORDER_STATUS_HISTORY : seguimiento
    PRODUCTS ||--o{ INVENTORY_MOVEMENTS : "kardex"
    SUPPLIERS ||--o{ PURCHASE_ORDERS : recibe
    PURCHASE_ORDERS ||--|{ PURCHASE_ORDER_ITEMS : contiene
    USERS ||--o{ SAVED_VEHICLES : "mi garaje"
    USERS ||--o{ REVIEWS : escribe
```

Ver el [esquema SQL completo](backend/src/db/schema.sql) y la [documentación técnica](docs/DOCUMENTACION.md).

## 🧠 Decisiones técnicas destacadas

| Decisión | Por qué |
|---|---|
| **El precio se calcula solo en el servidor** | El carrito y el pedido usan la misma función. El total cotizado es el cobrado, y el cliente no puede manipularlo. |
| **El pedido se crea en una transacción con `FOR UPDATE`** | Dos clientes no pueden comprar la última unidad al mismo tiempo. Si se cancela, el stock vuelve con su movimiento de inventario. |
| **El costo se guarda en cada línea del pedido** | La utilidad de los reportes es la real del momento de la venta, aunque el costo cambie después. |
| **Compatibilidad como modelo + año + motor** | Permite filtrar con exactitud y cargar rangos ("Corolla 2009–2014 1.8L") en lote. |
| **Búsqueda normalizada** | `04465-02220` = `0446502220` y `bujias` = `bujías`. |
| **Doble motor de base de datos** | `DATABASE_URL` → PostgreSQL/Supabase; sin ella, PGlite (Postgres en WASM) para correr la demo sin instalar nada. |
| **Permisos por módulo** | Validados en la API **y** en el frontend; el costo nunca se envía a los clientes. |

## 🚀 Instalación rápida

```bash
git clone https://github.com/alcedoanggi-crypto/sistema_repuesto_carros.git
cd sistema_repuesto_carros

# API (puerto 4600)
cd backend
npm install
cp .env.example .env       # cambia JWT_SECRET
npm run seed               # tablas + datos de ejemplo
npm run dev

# Tienda (puerto 5180), en otra terminal
cd ../frontend
npm install
npm run dev
```

Abre **http://localhost:5180**. El panel está en **/admin**.

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin@macai.com` | `Admin1234` | Administrador |
| `ventas@macai.com` | `Ventas1234` | Empleado (pedidos, clientes, productos) |
| `cliente@macai.com` | `Cliente1234` | Cliente con un Corolla 2012 guardado |
| `taller@macai.com` | `Cliente1234` | Cliente taller (precios especiales) |

> Para usar **PostgreSQL o Supabase**, define `DATABASE_URL` en `backend/.env` y ejecuta `npm run seed`. Más detalles en la [documentación técnica](docs/DOCUMENTACION.md#4-instalación-y-ejecución).

## 📁 Estructura

```
├── backend/     API REST: rutas, servicios (precios, pedidos, catálogo), esquema SQL y seed
├── frontend/    React: tienda pública, cuenta del cliente y panel administrativo
└── docs/        Documentación técnica y capturas
```

## 📝 Notas

- Los datos de ejemplo (números OEM, precios, cuentas bancarias) son **ilustrativos**.
- El comprobante PDF es **no fiscal**. En Venezuela la factura fiscal requiere máquina fiscal o imprenta autorizada por el SENIAT.

---

<div align="center">

Desarrollado por **Anggie** · [Portafolio](https://alcedoanggi-crypto.github.io)

</div>
