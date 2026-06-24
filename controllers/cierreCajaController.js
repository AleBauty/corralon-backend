const pool = require('../db/connection');

const resumenDia = async (req, res) => {
  try {
    const { fecha } = req.query;
    const fechaConsulta = fecha || new Date().toISOString().substring(0, 10);

    const vRes = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN LOWER(forma_pago_1) = 'efectivo'         THEN COALESCE(monto_pago_1,0) ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN LOWER(forma_pago_2) = 'efectivo'       THEN COALESCE(monto_pago_2,0) ELSE 0 END), 0) AS efectivo,
        COALESCE(SUM(CASE WHEN LOWER(forma_pago_1) = 'tarjeta'          THEN COALESCE(monto_pago_1,0) ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN LOWER(forma_pago_2) = 'tarjeta'        THEN COALESCE(monto_pago_2,0) ELSE 0 END), 0) AS tarjeta,
        COALESCE(SUM(CASE WHEN LOWER(forma_pago_1) = 'transferencia'    THEN COALESCE(monto_pago_1,0) ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN LOWER(forma_pago_2) = 'transferencia'  THEN COALESCE(monto_pago_2,0) ELSE 0 END), 0) AS transferencia,
        COALESCE(SUM(CASE WHEN LOWER(forma_pago_1) = 'cuenta corriente' THEN COALESCE(monto_pago_1,0) ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN LOWER(forma_pago_2) = 'cuenta corriente' THEN COALESCE(monto_pago_2,0) ELSE 0 END), 0) AS cuenta_corriente
       FROM ventas
       WHERE DATE(fecha) = $1 AND estado != 'Cancelada'`,
      [fechaConsulta]
    );

    const eRes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM egresos WHERE DATE(fecha) = $1`,
      [fechaConsulta]
    );

    const v = vRes.rows[0];
    const efectivo        = parseFloat(v.efectivo);
    const tarjeta         = parseFloat(v.tarjeta);
    const transferencia   = parseFloat(v.transferencia);
    const cuentaCorriente = parseFloat(v.cuenta_corriente);
    const totalEgresos    = parseFloat(eRes.rows[0].total);
    const totalNeto       = efectivo + tarjeta + transferencia + cuentaCorriente - totalEgresos;

    const ventasDetalle = await pool.query(
      `SELECT v.id, v.fecha, v.total, v.forma_pago_1, v.monto_pago_1, v.forma_pago_2, v.monto_pago_2,
              c.nombre_apellido AS cliente
       FROM ventas v LEFT JOIN clientes c ON v.dni_cliente = c.dni
       WHERE DATE(v.fecha) = $1 AND v.estado != 'Cancelada'
       ORDER BY v.fecha DESC`,
      [fechaConsulta]
    );

    const egresosDetalle = await pool.query(
      `SELECT * FROM egresos WHERE DATE(fecha) = $1 ORDER BY fecha DESC`,
      [fechaConsulta]
    );

    res.json({
      fecha:                  fechaConsulta,
      total_efectivo:         parseFloat(efectivo.toFixed(2)),
      total_tarjeta:          parseFloat(tarjeta.toFixed(2)),
      total_transferencia:    parseFloat(transferencia.toFixed(2)),
      total_cuenta_corriente: parseFloat(cuentaCorriente.toFixed(2)),
      total_egresos:          parseFloat(totalEgresos.toFixed(2)),
      total_neto:             parseFloat(totalNeto.toFixed(2)),
      ventas:                 ventasDetalle.rows,
      egresos:                egresosDetalle.rows,
      ya_cerrado:             false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const cerrar = async (req, res) => {
  try {
    const { fecha, observaciones, usuario } = req.body;
    const fechaCierre = fecha || new Date().toISOString().substring(0, 10);

    const existing = await pool.query('SELECT id FROM cierres_caja WHERE fecha = $1', [fechaCierre]);
    if (existing.rows.length)
      return res.status(409).json({ error: 'Ya existe un cierre para esta fecha' });

    const vRes = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN LOWER(forma_pago_1) = 'efectivo'         THEN COALESCE(monto_pago_1,0) ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN LOWER(forma_pago_2) = 'efectivo'       THEN COALESCE(monto_pago_2,0) ELSE 0 END), 0) AS efectivo,
        COALESCE(SUM(CASE WHEN LOWER(forma_pago_1) = 'tarjeta'          THEN COALESCE(monto_pago_1,0) ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN LOWER(forma_pago_2) = 'tarjeta'        THEN COALESCE(monto_pago_2,0) ELSE 0 END), 0) AS tarjeta,
        COALESCE(SUM(CASE WHEN LOWER(forma_pago_1) = 'transferencia'    THEN COALESCE(monto_pago_1,0) ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN LOWER(forma_pago_2) = 'transferencia'  THEN COALESCE(monto_pago_2,0) ELSE 0 END), 0) AS transferencia,
        COALESCE(SUM(CASE WHEN LOWER(forma_pago_1) = 'cuenta corriente' THEN COALESCE(monto_pago_1,0) ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN LOWER(forma_pago_2) = 'cuenta corriente' THEN COALESCE(monto_pago_2,0) ELSE 0 END), 0) AS cc
       FROM ventas WHERE DATE(fecha) = $1 AND estado != 'Cancelada'`,
      [fechaCierre]
    );
    const eRes = await pool.query(
      'SELECT COALESCE(SUM(monto), 0) AS total FROM egresos WHERE DATE(fecha) = $1',
      [fechaCierre]
    );

    const v = vRes.rows[0];
    const ef   = parseFloat(v.efectivo);
    const ta   = parseFloat(v.tarjeta);
    const tr   = parseFloat(v.transferencia);
    const cc   = parseFloat(v.cc);
    const eg   = parseFloat(eRes.rows[0].total);
    const neto = ef + ta + tr + cc - eg;

    const result = await pool.query(
      `INSERT INTO cierres_caja
         (fecha, total_efectivo, total_tarjeta, total_transferencia, total_cuenta_corriente,
          total_egresos, total_neto, usuario, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [fechaCierre, ef.toFixed(2), ta.toFixed(2), tr.toFixed(2),
       cc.toFixed(2), eg.toFixed(2), neto.toFixed(2), usuario ?? null, observaciones ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const historial = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let query = 'SELECT * FROM cierres_caja WHERE 1=1';
    const vals = [];
    if (desde) { vals.push(desde); query += ` AND fecha >= $${vals.length}`; }
    if (hasta) { vals.push(hasta); query += ` AND fecha <= $${vals.length}`; }
    query += ' ORDER BY fecha DESC';
    const result = await pool.query(query, vals);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { resumenDia, cerrar, historial };
