require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Ejecutando migración 2...');

    await client.query(`
      ALTER TABLE empleados
        ADD COLUMN IF NOT EXISTS tarifa_hora DECIMAL(10,2)
    `);
    console.log('✓ empleados.tarifa_hora');

    await client.query(`
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
      )
    `);
    console.log('✓ tabla remuneraciones');

    await client.query(`
      CREATE TABLE IF NOT EXISTS vehiculos (
        id      SERIAL PRIMARY KEY,
        patente VARCHAR(20) UNIQUE NOT NULL,
        tipo    VARCHAR(50),
        marca   VARCHAR(50),
        modelo  VARCHAR(50),
        anio    INTEGER,
        estado  VARCHAR(30) DEFAULT 'Disponible'
      )
    `);
    console.log('✓ tabla vehiculos');

    await client.query(`
      ALTER TABLE ventas
        ADD COLUMN IF NOT EXISTS vehiculo_id INTEGER REFERENCES vehiculos(id)
    `);
    console.log('✓ ventas.vehiculo_id');

    await client.query(`
      CREATE TABLE IF NOT EXISTS cuenta_corriente (
        id          SERIAL PRIMARY KEY,
        dni_cliente VARCHAR(15) REFERENCES clientes(dni),
        venta_id    INTEGER REFERENCES ventas(id),
        fecha       DATE    DEFAULT CURRENT_DATE,
        concepto    VARCHAR(200),
        debe        DECIMAL(12,2) DEFAULT 0,
        haber       DECIMAL(12,2) DEFAULT 0,
        saldo       DECIMAL(12,2) DEFAULT 0
      )
    `);
    console.log('✓ tabla cuenta_corriente');

    console.log('\nMigración completada.');
  } catch (err) {
    console.error('Error en migración:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
