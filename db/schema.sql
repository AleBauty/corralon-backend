CREATE TABLE IF NOT EXISTS categorias_producto (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  porcentaje_ganancia DECIMAL(5,2) NOT NULL,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS proveedores (
  cuit VARCHAR(20) PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(50),
  email VARCHAR(100),
  direccion VARCHAR(200),
  provincia VARCHAR(100),
  contacto VARCHAR(100),
  cbu VARCHAR(50),
  observaciones TEXT,
  estado VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE IF NOT EXISTS productos (
  codigo VARCHAR(20) PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  categoria_id INTEGER REFERENCES categorias_producto(id),
  marca VARCHAR(100),
  stock_actual DECIMAL(10,2) DEFAULT 0,
  stock_minimo DECIMAL(10,2) DEFAULT 0,
  proveedor_principal VARCHAR(20) REFERENCES proveedores(cuit),
  proveedor_secundario VARCHAR(20) REFERENCES proveedores(cuit),
  precio_costo DECIMAL(12,2) NOT NULL,
  porcentaje_ganancia DECIMAL(5,2) NOT NULL,
  precio_venta DECIMAL(12,2) GENERATED ALWAYS AS
    (ROUND(precio_costo * (1 + porcentaje_ganancia / 100), 2)) STORED
);

CREATE TABLE IF NOT EXISTS clientes (
  dni VARCHAR(15) PRIMARY KEY,
  nombre_apellido VARCHAR(150) NOT NULL,
  telefono VARCHAR(50),
  email VARCHAR(100),
  domicilio VARCHAR(200),
  tipo VARCHAR(20) DEFAULT 'Normal'
);

CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  dni_cliente VARCHAR(15) REFERENCES clientes(dni),
  fecha TIMESTAMP DEFAULT NOW(),
  total DECIMAL(12,2),
  forma_pago VARCHAR(30),
  forma_entrega VARCHAR(20),
  estado VARCHAR(20) DEFAULT 'Activa',
  observaciones TEXT
);

CREATE TABLE IF NOT EXISTS venta_items (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER REFERENCES ventas(id),
  producto_codigo VARCHAR(20) REFERENCES productos(codigo),
  cantidad DECIMAL(10,2),
  precio_unitario DECIMAL(12,2),
  subtotal DECIMAL(12,2)
);

CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  proveedor_cuit VARCHAR(20) REFERENCES proveedores(cuit),
  fecha TIMESTAMP DEFAULT NOW(),
  fecha_recepcion TIMESTAMP,
  total DECIMAL(12,2),
  estado VARCHAR(20) DEFAULT 'Pendiente',
  observaciones TEXT
);

CREATE TABLE IF NOT EXISTS pedido_items (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER REFERENCES pedidos(id),
  producto_codigo VARCHAR(20) REFERENCES productos(codigo),
  cantidad DECIMAL(10,2),
  precio_unitario DECIMAL(12,2),
  subtotal DECIMAL(12,2)
);
