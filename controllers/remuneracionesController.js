const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const { dni } = req.query;
    const cond = dni ? 'WHERE r.dni_empleado = $1' : '';
    const vals = dni ? [dni] : [];
    const result = await pool.query(
      `SELECT r.*, e.nombre AS empleado
       FROM remuneraciones r
       LEFT JOIN empleados e ON r.dni_empleado = e.dni
       ${cond}
       ORDER BY r.created_at DESC`,
      vals
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const calcular = async (req, res) => {
  try {
    const { dni_empleado, periodo, fecha_desde, fecha_hasta } = req.body;
    if (!dni_empleado || !fecha_desde || !fecha_hasta)
      return res.status(400).json({ error: 'DNI, fecha_desde y fecha_hasta son obligatorios' });

    const emp = await pool.query('SELECT * FROM empleados WHERE dni = $1', [dni_empleado]);
    if (!emp.rows.length)
      return res.status(404).json({ error: 'Empleado no encontrado' });
    if (!emp.rows[0].tarifa_hora)
      return res.status(400).json({ error: 'El empleado no tiene tarifa por hora configurada. Editalo primero.' });

    const horasRes = await pool.query(
      `SELECT COALESCE(SUM(horas_trabajadas), 0) AS total
       FROM asistencias
       WHERE dni_empleado = $1
         AND fecha BETWEEN $2 AND $3
         AND horas_trabajadas IS NOT NULL`,
      [dni_empleado, fecha_desde, fecha_hasta]
    );

    const horas_trabajadas = parseFloat(horasRes.rows[0].total);
    const tarifa_hora      = parseFloat(emp.rows[0].tarifa_hora);
    const total            = (horas_trabajadas * tarifa_hora).toFixed(2);

    const result = await pool.query(
      `INSERT INTO remuneraciones (dni_empleado, periodo, horas_trabajadas, tarifa_hora, total)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [dni_empleado, periodo ?? `${fecha_desde} al ${fecha_hasta}`, horas_trabajadas, tarifa_hora, total]
    );
    res.status(201).json({ ...result.rows[0], empleado: emp.rows[0].nombre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const pagar = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_pago } = req.body ?? {};
    const result = await pool.query(
      `UPDATE remuneraciones
       SET estado = 'Pagado', fecha_pago = COALESCE($1::date, CURRENT_DATE)
       WHERE id = $2 RETURNING *`,
      [fecha_pago ?? null, id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Remuneración no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, calcular, pagar };
