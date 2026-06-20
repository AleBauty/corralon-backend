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
    console.log('Ejecutando migración 3...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS categorias_empleado (
        id          SERIAL PRIMARY KEY,
        nombre      VARCHAR(100) UNIQUE NOT NULL,
        tarifa_hora DECIMAL(10,2) NOT NULL,
        descripcion TEXT,
        estado      VARCHAR(20) DEFAULT 'Activo'
      )
    `);
    console.log('✓ tabla categorias_empleado');

    await client.query(`
      CREATE TABLE IF NOT EXISTS mantenimiento_vehiculos (
        id               SERIAL PRIMARY KEY,
        vehiculo_id      INTEGER REFERENCES vehiculos(id),
        tipo             VARCHAR(50),
        descripcion      TEXT,
        fecha            DATE DEFAULT CURRENT_DATE,
        costo            DECIMAL(12,2),
        kilometraje      INTEGER,
        proximo_service  INTEGER,
        estado           VARCHAR(20) DEFAULT 'Realizado'
      )
    `);
    console.log('✓ tabla mantenimiento_vehiculos');

    await client.query(`
      ALTER TABLE vehiculos
        ADD COLUMN IF NOT EXISTS kilometraje_actual INTEGER
    `);
    console.log('✓ vehiculos.kilometraje_actual');

    await client.query(`
      ALTER TABLE empleados
        ADD COLUMN IF NOT EXISTS tarifa_hora DECIMAL(10,2)
    `);
    console.log('✓ empleados.tarifa_hora (ya existía si migrate2 fue ejecutado)');

    console.log('\nMigración 3 completada.');
  } catch (err) {
    console.error('Error en migración 3:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
