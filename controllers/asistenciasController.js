const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const { dni, fecha_desde, fecha_hasta } = req.query;
    const conds = [];
    const vals  = [];

    if (dni)         { conds.push(`a.dni_empleado = $${vals.length + 1}`); vals.push(dni); }
    if (fecha_desde) { conds.push(`a.fecha >= $${vals.length + 1}`);       vals.push(fecha_desde); }
    if (fecha_hasta) { conds.push(`a.fecha <= $${vals.length + 1}`);       vals.push(fecha_hasta); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT a.*, e.nombre AS empleado
       FROM asistencias a
       LEFT JOIN empleados e ON a.dni_empleado = e.dni
       ${where}
       ORDER BY a.fecha DESC, a.hora_entrada DESC`,
      vals
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const registrarEntrada = async (req, res) => {
  try {
    const { dni_empleado, fecha } = req.body;
    if (!dni_empleado?.trim())
      return res.status(400).json({ error: 'El DNI del empleado es obligatorio' });

    const emp = await pool.query('SELECT * FROM empleados WHERE dni = $1', [dni_empleado.trim()]);
    if (!emp.rows.length)
      return res.status(404).json({ error: 'Empleado no encontrado' });

    const fechaUsar = fecha ?? new Date().toISOString().split('T')[0];

    const yaEntro = await pool.query(
      'SELECT id FROM asistencias WHERE dni_empleado = $1 AND fecha = $2 AND hora_salida IS NULL',
      [dni_empleado.trim(), fechaUsar]
    );
    if (yaEntro.rows.length)
      return res.status(409).json({ error: `${emp.rows[0].nombre} ya tiene entrada registrada para esta fecha` });

    const result = await pool.query(
      `INSERT INTO asistencias (dni_empleado, fecha, hora_entrada)
       VALUES ($1, $2, LOCALTIME) RETURNING *`,
      [dni_empleado.trim(), fechaUsar]
    );
    res.status(201).json({ ...result.rows[0], empleado: emp.rows[0].nombre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const registrarSalida = async (req, res) => {
  try {
    const { dni_empleado, fecha } = req.body;
    if (!dni_empleado?.trim())
      return res.status(400).json({ error: 'El DNI del empleado es obligatorio' });

    const emp = await pool.query('SELECT * FROM empleados WHERE dni = $1', [dni_empleado.trim()]);
    if (!emp.rows.length)
      return res.status(404).json({ error: 'Empleado no encontrado' });

    const fechaUsar = fecha ?? new Date().toISOString().split('T')[0];

    const asist = await pool.query(
      'SELECT * FROM asistencias WHERE dni_empleado = $1 AND fecha = $2 AND hora_salida IS NULL ORDER BY id DESC LIMIT 1',
      [dni_empleado.trim(), fechaUsar]
    );
    if (!asist.rows.length)
      return res.status(404).json({ error: `No hay entrada abierta para ${emp.rows[0].nombre} en esta fecha` });

    const result = await pool.query(
      `UPDATE asistencias
       SET hora_salida = LOCALTIME,
           horas_trabajadas = ROUND(EXTRACT(EPOCH FROM (LOCALTIME - hora_entrada)) / 3600, 2)
       WHERE id = $1 RETURNING *`,
      [asist.rows[0].id]
    );
    res.json({ ...result.rows[0], empleado: emp.rows[0].nombre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, registrarEntrada, registrarSalida };
