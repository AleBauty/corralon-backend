const pool = require('../db/connection');

const fmtNum = n => parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: 2 });

// Todos los clientes tipo 'Cuenta corriente', con o sin movimientos
const listarClientes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.dni, c.nombre_apellido, c.telefono, c.domicilio,
        COALESCE(c.limite_credito, 50000) AS limite_credito,
        COALESCE(SUM(cc.debe - cc.haber), 0) AS saldo,
        COALESCE(BOOL_OR(cc.debe > 0 AND (CURRENT_DATE - cc.fecha::date) > 14), false) AS tiene_debe_antiguo
      FROM clientes c
      LEFT JOIN cuenta_corriente cc ON c.dni = cc.dni_cliente
      WHERE c.tipo = 'Cuenta corriente'
      GROUP BY c.dni, c.nombre_apellido, c.telefono, c.domicilio, c.limite_credito
      ORDER BY COALESCE(SUM(cc.debe - cc.haber), 0) DESC, c.nombre_apellido
    `);
    res.json(result.rows.map(r => ({
      ...r,
      saldo:              parseFloat(r.saldo),
      limite_credito:     parseFloat(r.limite_credito),
      tiene_deuda_atrasada: r.tiene_debe_antiguo && parseFloat(r.saldo) > 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Historial cronológico de movimientos (para el panel expandible)
const listarMovimientos = async (req, res) => {
  try {
    const { dni } = req.params;
    const movResult = await pool.query(
      `SELECT cc.*,
              SUM(cc.debe - cc.haber) OVER (ORDER BY cc.fecha, cc.id) AS saldo_acumulado
       FROM cuenta_corriente cc
       WHERE cc.dni_cliente = $1
       ORDER BY cc.fecha, cc.id`,
      [dni]
    );
    const saldoRes = await pool.query(
      `SELECT COALESCE(SUM(debe - haber), 0) AS saldo FROM cuenta_corriente WHERE dni_cliente = $1`,
      [dni]
    );
    res.json({ movimientos: movResult.rows, saldo: parseFloat(saldoRes.rows[0].saldo ?? 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Deudas individuales con saldo pendiente calculado por FIFO (payments oldest-first)
const listarDeudas = async (req, res) => {
  try {
    const { dni } = req.params;

    const deudasRes = await pool.query(`
      WITH deudas_ordered AS (
        SELECT
          cc.*,
          SUM(cc.debe) OVER (
            ORDER BY cc.fecha ASC, cc.id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS debe_cumsum,
          (CURRENT_DATE - cc.fecha::date)::integer AS dias_transcurridos
        FROM cuenta_corriente cc
        WHERE cc.dni_cliente = $1 AND cc.debe > 0
      ),
      totales AS (
        SELECT
          GREATEST(0, COALESCE(SUM(debe - haber), 0)) AS saldo,
          COALESCE(SUM(haber), 0)                     AS total_pagado
        FROM cuenta_corriente WHERE dni_cliente = $1
      )
      SELECT
        d.id, d.venta_id, d.concepto, d.debe::numeric, d.fecha,
        d.dias_transcurridos,
        GREATEST(0, d.debe - GREATEST(0::numeric, t.total_pagado - (d.debe_cumsum - d.debe))) AS saldo_pendiente,
        t.saldo AS saldo_total
      FROM deudas_ordered d, totales t
      ORDER BY d.fecha ASC, d.id ASC
    `, [dni]);

    const clienteRes = await pool.query(
      `SELECT COALESCE(limite_credito, 50000) AS limite_credito FROM clientes WHERE dni = $1`,
      [dni]
    );
    const saldoRes = await pool.query(
      `SELECT COALESCE(SUM(debe - haber), 0) AS saldo FROM cuenta_corriente WHERE dni_cliente = $1`,
      [dni]
    );

    res.json({
      deudas:         deudasRes.rows,
      saldo:          parseFloat(saldoRes.rows[0]?.saldo ?? 0),
      limite_credito: parseFloat(clienteRes.rows[0]?.limite_credito ?? 50000),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const registrarPago = async (req, res) => {
  try {
    const { dni_cliente, monto, concepto } = req.body;
    if (!dni_cliente || !monto || parseFloat(monto) <= 0)
      return res.status(400).json({ error: 'dni_cliente y monto mayor a 0 son obligatorios' });

    const saldoRes = await pool.query(
      `SELECT COALESCE(SUM(debe - haber), 0) AS saldo FROM cuenta_corriente WHERE dni_cliente = $1`,
      [dni_cliente]
    );
    const saldoAnterior = parseFloat(saldoRes.rows[0]?.saldo ?? 0);
    const montoPago     = parseFloat(monto);

    if (montoPago > saldoAnterior + 0.01) {
      return res.status(400).json({
        error: `El pago ($${fmtNum(montoPago)}) supera la deuda actual ($${fmtNum(saldoAnterior)}). Máximo a pagar: $${fmtNum(saldoAnterior)}`,
      });
    }

    const nuevoSaldo = Math.max(0, saldoAnterior - montoPago);
    const result = await pool.query(
      `INSERT INTO cuenta_corriente (dni_cliente, concepto, haber, saldo)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [dni_cliente, concepto?.trim() || 'Pago', montoPago.toFixed(2), nuevoSaldo.toFixed(2)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Llamado internamente desde ventasController dentro de una transacción
const crearDeudaEnTransaccion = async (client, { dni_cliente, venta_id, total, monto_cc }) => {
  const montoDeuda = monto_cc != null ? parseFloat(monto_cc) : parseFloat(total);

  // Validar límite de crédito
  const clienteRes = await client.query(
    `SELECT COALESCE(limite_credito, 50000) AS limite_credito FROM clientes WHERE dni = $1`,
    [dni_cliente]
  );
  const limite = parseFloat(clienteRes.rows[0]?.limite_credito ?? 50000);

  const saldoRes = await client.query(
    `SELECT COALESCE(SUM(debe - haber), 0) AS saldo FROM cuenta_corriente WHERE dni_cliente = $1`,
    [dni_cliente]
  );
  const saldoActual = parseFloat(saldoRes.rows[0]?.saldo ?? 0);

  if (saldoActual + montoDeuda > limite) {
    throw new Error(
      `Límite de crédito excedido. Límite: $${fmtNum(limite)} | Deuda actual: $${fmtNum(saldoActual)} | Esta compra: $${fmtNum(montoDeuda)} | Total resultante: $${fmtNum(saldoActual + montoDeuda)}`
    );
  }

  const nuevoSaldo = saldoActual + montoDeuda;
  const fecha = new Date().toISOString().substring(0, 10);

  await client.query(
    `INSERT INTO cuenta_corriente (dni_cliente, venta_id, concepto, debe, saldo, fecha)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      dni_cliente,
      venta_id,
      `Venta #${venta_id} — ${fecha}`,
      montoDeuda.toFixed(2),
      nuevoSaldo.toFixed(2),
      fecha,
    ]
  );
};

module.exports = {
  listarClientes, listarMovimientos, listarDeudas,
  registrarPago, crearDeudaEnTransaccion,
};
