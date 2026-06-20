require('dotenv').config();
const pool = require('./db/connection');

async function migrate4() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Iniciando migración 4...');

    // 1. limite_credito en clientes
    await client.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS limite_credito DECIMAL(12,2) DEFAULT 50000`);
    console.log('✓ clientes.limite_credito');

    // 2. Medios de pago múltiples en ventas
    await client.query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS forma_pago_1  VARCHAR(50)`);
    await client.query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_pago_1  DECIMAL(12,2)`);
    await client.query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS forma_pago_2  VARCHAR(50)`);
    await client.query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_pago_2  DECIMAL(12,2)`);
    console.log('✓ ventas: columnas dual pago');

    // 3. Backfill ventas existentes
    await client.query(`
      UPDATE ventas
      SET forma_pago_1 = forma_pago, monto_pago_1 = total
      WHERE forma_pago_1 IS NULL AND forma_pago IS NOT NULL
    `);
    console.log('✓ ventas existentes: backfill forma_pago_1');

    // 4. Cliente de ejemplo Roberto Medina
    await client.query(`
      INSERT INTO clientes (dni, nombre_apellido, tipo, limite_credito)
      VALUES ('32000001', 'Roberto Medina', 'Cuenta corriente', 100000)
      ON CONFLICT (dni) DO UPDATE
        SET nombre_apellido = 'Roberto Medina',
            tipo            = 'Cuenta corriente',
            limite_credito  = 100000
    `);
    console.log('✓ Cliente Roberto Medina');

    // 5. Deudas de ejemplo (fechas relativas)
    await client.query(`DELETE FROM cuenta_corriente WHERE dni_cliente = '32000001'`);
    await client.query(`
      INSERT INTO cuenta_corriente (dni_cliente, concepto, debe, haber, saldo, fecha)
      VALUES
        ('32000001', 'Compra materiales de construcción', 28500.00, 0, 28500.00, CURRENT_DATE - INTERVAL '35 days'),
        ('32000001', 'Compra cemento y ladrillos',        15000.00, 0, 43500.00, CURRENT_DATE - INTERVAL '20 days'),
        ('32000001', 'Compra arena y canto rodado',       12000.00, 0, 55500.00, CURRENT_DATE - INTERVAL  '5 days')
    `);
    console.log('✓ Deudas de ejemplo Roberto Medina (35d, 20d, 5d)');

    await client.query('COMMIT');
    console.log('\n✅ Migración 4 completada');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error en migración 4:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate4();
