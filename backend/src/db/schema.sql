-- =====================================================================
-- MACAI Autopartes — Esquema PostgreSQL
-- Compatible con PostgreSQL 14+, Supabase y PGlite (modo demo local).
-- Montos en bolívares (Bs.) con NUMERIC(14,2).
-- =====================================================================

-- ---------- Usuarios y cuentas ----------
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(160) NOT NULL UNIQUE,
  password_hash   VARCHAR(200) NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'cliente'
                  CHECK (role IN ('cliente','empleado','admin')),
  customer_type   VARCHAR(20)  NOT NULL DEFAULT 'normal'
                  CHECK (customer_type IN ('normal','taller','mayorista')),
  doc_id          VARCHAR(20),               -- Cédula o RIF (V-12345678, J-40123456-7)
  phone           VARCHAR(30),
  permissions     TEXT[] NOT NULL DEFAULT '{}', -- módulos del panel (solo empleados)
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addresses (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       VARCHAR(60)  NOT NULL DEFAULT 'Principal',
  recipient   VARCHAR(120) NOT NULL,
  phone       VARCHAR(30)  NOT NULL,
  state       VARCHAR(60)  NOT NULL,          -- Estado (Miranda, Zulia, ...)
  city        VARCHAR(80)  NOT NULL,
  line        VARCHAR(250) NOT NULL,          -- Urbanización, calle, casa/apto
  reference   VARCHAR(250),                   -- Punto de referencia
  is_default  BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------- Catálogo de compatibilidad (Marca → Modelo → Año → Motor) ----------
CREATE TABLE IF NOT EXISTS vehicle_makes (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(60) NOT NULL UNIQUE,
  slug  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id       SERIAL PRIMARY KEY,
  make_id  INT NOT NULL REFERENCES vehicle_makes(id) ON DELETE CASCADE,
  name     VARCHAR(80) NOT NULL,
  UNIQUE (make_id, name)
);

-- Cada fila es una combinación concreta modelo + año + motor.
CREATE TABLE IF NOT EXISTS vehicles (
  id        SERIAL PRIMARY KEY,
  model_id  INT NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  year      INT NOT NULL CHECK (year BETWEEN 1950 AND 2100),
  engine    VARCHAR(80) NOT NULL,             -- "1.8L 4 cil. Gasolina"
  UNIQUE (model_id, year, engine)
);

-- ---------- Productos ----------
CREATE TABLE IF NOT EXISTS categories (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(80) NOT NULL UNIQUE,
  slug         VARCHAR(80) NOT NULL UNIQUE,
  icon         VARCHAR(40) NOT NULL DEFAULT 'box',
  description  TEXT,
  sort_order   INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS part_brands (           -- marca del repuesto (Bosch, Toyota...)
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(80) NOT NULL UNIQUE,
  slug  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id                 SERIAL PRIMARY KEY,
  sku                VARCHAR(40)  NOT NULL UNIQUE,
  oem_number         VARCHAR(60),               -- número de parte original
  manufacturer_code  VARCHAR(60),               -- código del fabricante del repuesto
  name               VARCHAR(200) NOT NULL,
  slug               VARCHAR(220) NOT NULL UNIQUE,
  description        TEXT,
  category_id        INT REFERENCES categories(id) ON DELETE SET NULL,
  brand_id           INT REFERENCES part_brands(id) ON DELETE SET NULL,
  is_original        BOOLEAN NOT NULL DEFAULT FALSE, -- original (OEM) vs genérico
  cost_price         NUMERIC(14,2) NOT NULL DEFAULT 0,
  price              NUMERIC(14,2) NOT NULL,    -- precio de venta (cliente normal, sin IVA)
  price_workshop     NUMERIC(14,2),             -- precio taller (opcional)
  price_wholesale    NUMERIC(14,2),             -- precio mayorista (opcional)
  stock              INT NOT NULL DEFAULT 0,
  min_stock          INT NOT NULL DEFAULT 0,
  warehouse_location VARCHAR(40),               -- Pasillo-Estante-Nivel
  warranty_months    INT NOT NULL DEFAULT 3,
  images             JSONB NOT NULL DEFAULT '[]',
  featured           BOOLEAN NOT NULL DEFAULT FALSE,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  sold_count         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_oem ON products(oem_number);

CREATE TABLE IF NOT EXISTS product_vehicles (      -- compatibilidad producto ↔ vehículo
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vehicle_id  INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  note        VARCHAR(120),                      -- "Solo delantero", "Con ABS"...
  PRIMARY KEY (product_id, vehicle_id)
);
CREATE INDEX IF NOT EXISTS idx_pv_vehicle ON product_vehicles(vehicle_id);

CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL PRIMARY KEY,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS saved_vehicles (        -- "Mi garaje"
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id  INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  nickname    VARCHAR(60),
  UNIQUE (user_id, vehicle_id)
);

-- ---------- Promociones ----------
CREATE TABLE IF NOT EXISTS coupons (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('percent','fixed')),
  value       NUMERIC(14,2) NOT NULL CHECK (value > 0),
  min_order   NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_uses    INT,                                -- NULL = ilimitado
  used_count  INT NOT NULL DEFAULT 0,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Descuento por categoría o por producto, con vigencia (ofertas por tiempo limitado).
CREATE TABLE IF NOT EXISTS promotions (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  scope        VARCHAR(10) NOT NULL CHECK (scope IN ('category','product')),
  category_id  INT REFERENCES categories(id) ON DELETE CASCADE,
  product_id   INT REFERENCES products(id) ON DELETE CASCADE,
  percent      NUMERIC(5,2) NOT NULL CHECK (percent > 0 AND percent < 100),
  starts_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at      TIMESTAMPTZ NOT NULL,
  banner       BOOLEAN NOT NULL DEFAULT FALSE,    -- mostrar en el banner de inicio
  active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Configuración ----------
CREATE TABLE IF NOT EXISTS settings (
  key    VARCHAR(60) PRIMARY KEY,
  value  JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_zones (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(80) NOT NULL,
  states    TEXT[] NOT NULL DEFAULT '{}',        -- estados que cubre
  cost      NUMERIC(14,2) NOT NULL DEFAULT 0,
  free_from NUMERIC(14,2),                       -- envío gratis desde este subtotal
  est_days  VARCHAR(30) NOT NULL DEFAULT '1-3 días',
  active    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id                  SERIAL PRIMARY KEY,
  code                VARCHAR(30) NOT NULL UNIQUE,
  name                VARCHAR(80) NOT NULL,
  instructions        TEXT,
  requires_reference  BOOLEAN NOT NULL DEFAULT FALSE,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          INT NOT NULL DEFAULT 0
);

-- ---------- Pedidos ----------
CREATE TABLE IF NOT EXISTS orders (
  id                 SERIAL PRIMARY KEY,
  code               VARCHAR(20) UNIQUE,         -- MAC-000123
  user_id            INT REFERENCES users(id) ON DELETE SET NULL,
  customer_name      VARCHAR(120) NOT NULL,
  customer_email     VARCHAR(160) NOT NULL,
  customer_phone     VARCHAR(30)  NOT NULL,
  customer_doc       VARCHAR(20)  NOT NULL,
  customer_type      VARCHAR(20)  NOT NULL DEFAULT 'normal',
  delivery_type      VARCHAR(10)  NOT NULL CHECK (delivery_type IN ('envio','retiro')),
  shipping_zone_id   INT REFERENCES shipping_zones(id) ON DELETE SET NULL,
  shipping_address   JSONB,
  payment_method     VARCHAR(30) NOT NULL,
  payment_reference  VARCHAR(60),
  status             VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                     CHECK (status IN ('pendiente','pagado','preparacion','enviado','entregado','cancelado')),
  subtotal           NUMERIC(14,2) NOT NULL,
  discount           NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_cost      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax                NUMERIC(14,2) NOT NULL DEFAULT 0,
  total              NUMERIC(14,2) NOT NULL,
  coupon_code        VARCHAR(30),
  carrier            VARCHAR(60),                -- MRW, Zoom, Tealca, delivery propio
  tracking_number    VARCHAR(60),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INT REFERENCES products(id) ON DELETE SET NULL,
  name        VARCHAR(200) NOT NULL,
  sku         VARCHAR(40)  NOT NULL,
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(14,2) NOT NULL,
  unit_cost   NUMERIC(14,2) NOT NULL DEFAULT 0,   -- para calcular utilidad
  total       NUMERIC(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id          SERIAL PRIMARY KEY,
  order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL,
  note        VARCHAR(250),
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Inventario ----------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id          SERIAL PRIMARY KEY,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type        VARCHAR(15) NOT NULL
              CHECK (type IN ('entrada','salida','ajuste','venta','devolucion','compra')),
  quantity    INT NOT NULL,                      -- con signo: +entra / -sale
  stock_after INT NOT NULL,
  reason      VARCHAR(250),
  reference   VARCHAR(60),                       -- pedido, orden de compra, etc.
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mov_product ON inventory_movements(product_id);

-- ---------- Proveedores y compras ----------
CREATE TABLE IF NOT EXISTS suppliers (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(120) NOT NULL,
  rif       VARCHAR(20),
  contact   VARCHAR(120),
  phone     VARCHAR(30),
  email     VARCHAR(160),
  address   VARCHAR(250),
  notes     TEXT,
  active    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(20) UNIQUE,               -- OC-000045
  supplier_id  INT NOT NULL REFERENCES suppliers(id),
  status       VARCHAR(15) NOT NULL DEFAULT 'borrador'
               CHECK (status IN ('borrador','enviada','recibida','cancelada')),
  notes        TEXT,
  total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by   INT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id          SERIAL PRIMARY KEY,
  po_id       INT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id  INT NOT NULL REFERENCES products(id),
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_cost   NUMERIC(14,2) NOT NULL
);
