-- ============================================================
-- Tablas faltantes (no incluidas en schema.sql original)
-- ============================================================

CREATE TABLE IF NOT EXISTS empleados (
  dni                 VARCHAR(15) PRIMARY KEY,
  nombre              VARCHAR(150) NOT NULL,
  telefono            VARCHAR(50),
  domicilio           VARCHAR(200),
  categoria           VARCHAR(100),
  usuario             VARCHAR(50) UNIQUE,
  fecha_incorporacion DATE,
  estado              VARCHAR(20) DEFAULT 'Activo',
  tarifa_hora         DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS asistencias (
  id               SERIAL PRIMARY KEY,
  dni_empleado     VARCHAR(15) REFERENCES empleados(dni),
  fecha            DATE    DEFAULT CURRENT_DATE,
  hora_entrada     TIME,
  hora_salida      TIME,
  horas_trabajadas DECIMAL(5,2)
);

CREATE TABLE IF NOT EXISTS presupuestos (
  id                SERIAL PRIMARY KEY,
  dni_cliente       VARCHAR(15) REFERENCES clientes(dni),
  fecha             TIMESTAMP DEFAULT NOW(),
  fecha_vencimiento TIMESTAMP,
  total             DECIMAL(12,2),
  estado            VARCHAR(20) DEFAULT 'Vigente',
  observaciones     TEXT
);

CREATE TABLE IF NOT EXISTS presupuesto_items (
  id              SERIAL PRIMARY KEY,
  presupuesto_id  INTEGER REFERENCES presupuestos(id),
  producto_codigo VARCHAR(20) REFERENCES productos(codigo),
  cantidad        DECIMAL(10,2),
  precio_unitario DECIMAL(12,2),
  subtotal        DECIMAL(12,2)
);

CREATE TABLE IF NOT EXISTS vehiculos (
  id                 SERIAL PRIMARY KEY,
  patente            VARCHAR(20) UNIQUE NOT NULL,
  tipo               VARCHAR(50),
  marca              VARCHAR(50),
  modelo             VARCHAR(50),
  anio               INTEGER,
  estado             VARCHAR(30) DEFAULT 'Disponible',
  kilometraje_actual INTEGER
);

CREATE TABLE IF NOT EXISTS remuneraciones (
  id               SERIAL PRIMARY KEY,
  dni_empleado     VARCHAR(15) REFERENCES empleados(dni),
  periodo          VARCHAR(50),
  horas_trabajadas DECIMAL(8,2),
  tarifa_hora      DECIMAL(10,2),
  total            DECIMAL(12,2),
  fecha_pago       DATE,
  estado           VARCHAR(20) DEFAULT 'Pendiente',
  created_at       TIMESTAMP  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cuenta_corriente (
  id          SERIAL PRIMARY KEY,
  dni_cliente VARCHAR(15) REFERENCES clientes(dni),
  venta_id    INTEGER REFERENCES ventas(id),
  fecha       DATE    DEFAULT CURRENT_DATE,
  concepto    VARCHAR(200),
  debe        DECIMAL(12,2) DEFAULT 0,
  haber       DECIMAL(12,2) DEFAULT 0,
  saldo       DECIMAL(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categorias_empleado (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) UNIQUE NOT NULL,
  tarifa_hora DECIMAL(10,2) NOT NULL,
  descripcion TEXT,
  estado      VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE IF NOT EXISTS mantenimiento_vehiculos (
  id              SERIAL PRIMARY KEY,
  vehiculo_id     INTEGER REFERENCES vehiculos(id),
  tipo            VARCHAR(50),
  descripcion     TEXT,
  fecha           DATE DEFAULT CURRENT_DATE,
  costo           DECIMAL(12,2),
  kilometraje     INTEGER,
  proximo_service INTEGER,
  estado          VARCHAR(20) DEFAULT 'Realizado'
);

-- ============================================================
-- Columnas adicionales en tablas existentes
-- ============================================================

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS vehiculo_id       INTEGER REFERENCES vehiculos(id);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS direccion_entrega VARCHAR(200);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS forma_pago_1      VARCHAR(50);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_pago_1      DECIMAL(12,2);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS forma_pago_2      VARCHAR(50);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_pago_2      DECIMAL(12,2);

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS limite_credito DECIMAL(12,2) DEFAULT 50000;

-- Backfill ventas existentes
UPDATE ventas
SET forma_pago_1 = forma_pago, monto_pago_1 = total
WHERE forma_pago_1 IS NULL AND forma_pago IS NOT NULL;

-- ============================================================
-- Datos de ejemplo: cliente cuenta corriente
-- ============================================================

INSERT INTO clientes (dni, nombre_apellido, tipo, limite_credito)
VALUES ('32000001', 'Roberto Medina', 'Cuenta corriente', 100000)
ON CONFLICT (dni) DO UPDATE
  SET nombre_apellido = 'Roberto Medina',
      tipo            = 'Cuenta corriente',
      limite_credito  = 100000;

DELETE FROM cuenta_corriente WHERE dni_cliente = '32000001';

INSERT INTO cuenta_corriente (dni_cliente, concepto, debe, haber, saldo, fecha)
VALUES
  ('32000001', 'Compra materiales de construcción', 28500.00, 0, 28500.00, CURRENT_DATE - INTERVAL '35 days'),
  ('32000001', 'Compra cemento y ladrillos',        15000.00, 0, 43500.00, CURRENT_DATE - INTERVAL '20 days'),
  ('32000001', 'Compra arena y canto rodado',       12000.00, 0, 55500.00, CURRENT_DATE - INTERVAL  '5 days');
