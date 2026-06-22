CREATE TABLE IF NOT EXISTS usuarios (
  id       SERIAL PRIMARY KEY,
  nombre   VARCHAR(150) NOT NULL,
  usuario  VARCHAR(50)  UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol      VARCHAR(30)  NOT NULL,
  estado   VARCHAR(20)  DEFAULT 'Activo'
);

INSERT INTO usuarios (nombre, usuario, password, rol) VALUES
('Administrador',    'admin',    'admin123',   'admin'),
('Vendedor',         'vendedor', 'venta123',   'vendedor'),
('Gerente Finanzas', 'gerente',  'gerente123', 'gerente_finanzas')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS egresos (
  id            SERIAL PRIMARY KEY,
  concepto      VARCHAR(200) NOT NULL,
  monto         DECIMAL(12,2) NOT NULL,
  fecha         TIMESTAMP DEFAULT NOW(),
  autorizado_por VARCHAR(50),
  estado        VARCHAR(20) DEFAULT 'Pendiente'
);
