const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM empleados ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const obtener = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM empleados WHERE dni = $1', [req.params.dni]);
    if (!result.rows.length)
      return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  try {
    const { dni, nombre, telefono, domicilio, categoria, usuario, fecha_incorporacion, tarifa_hora } = req.body;
    if (!dni?.trim() || !nombre?.trim())
      return res.status(400).json({ error: 'DNI y nombre son obligatorios' });

    const result = await pool.query(
      `INSERT INTO empleados (dni, nombre, telefono, domicilio, categoria, usuario, fecha_incorporacion, tarifa_hora)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [dni.trim(), nombre.trim(), telefono ?? null, domicilio ?? null,
       categoria ?? null, usuario ?? null, fecha_incorporacion ?? null,
       tarifa_hora != null ? parseFloat(tarifa_hora) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const campo = err.constraint?.includes('usuario') ? 'usuario' : 'DNI';
      return res.status(409).json({ error: `Ya existe un empleado con ese ${campo}` });
    }
    res.status(500).json({ error: err.message });
  }
};

const modificar = async (req, res) => {
  try {
    const { dni } = req.params;
    const { nombre, telefono, domicilio, categoria, usuario, fecha_incorporacion, estado, tarifa_hora } = req.body;
    const result = await pool.query(
      `UPDATE empleados SET
         nombre              = COALESCE($1, nombre),
         telefono            = COALESCE($2, telefono),
         domicilio           = COALESCE($3, domicilio),
         categoria           = COALESCE($4, categoria),
         usuario             = COALESCE($5, usuario),
         fecha_incorporacion = COALESCE($6, fecha_incorporacion),
         estado              = COALESCE($7, estado),
         tarifa_hora         = $8
       WHERE dni = $9 RETURNING *`,
      [nombre, telefono, domicilio, categoria, usuario,
       fecha_incorporacion, estado,
       tarifa_hora != null ? parseFloat(tarifa_hora) : null,
       dni]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, obtener, crear, modificar };
