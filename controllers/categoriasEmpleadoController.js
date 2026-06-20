const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM categorias_empleado ORDER BY nombre`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  try {
    const { nombre, tarifa_hora, descripcion, estado } = req.body;
    if (!nombre?.trim())
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!tarifa_hora || parseFloat(tarifa_hora) <= 0)
      return res.status(400).json({ error: 'La tarifa por hora debe ser mayor a 0' });

    const result = await pool.query(
      `INSERT INTO categorias_empleado (nombre, tarifa_hora, descripcion, estado)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre.trim(), parseFloat(tarifa_hora),
       descripcion?.trim() || null, estado || 'Activo']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    res.status(500).json({ error: err.message });
  }
};

const modificar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tarifa_hora, descripcion, estado } = req.body;

    if (!nombre?.trim())
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!tarifa_hora || parseFloat(tarifa_hora) <= 0)
      return res.status(400).json({ error: 'La tarifa por hora debe ser mayor a 0' });

    const result = await pool.query(
      `UPDATE categorias_empleado
       SET nombre=$1, tarifa_hora=$2, descripcion=$3, estado=$4
       WHERE id=$5 RETURNING *`,
      [nombre.trim(), parseFloat(tarifa_hora),
       descripcion?.trim() || null, estado || 'Activo', id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, crear, modificar };
