const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT *, COALESCE(limite_credito, 50000) AS limite_credito FROM clientes ORDER BY nombre_apellido'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const obtener = async (req, res) => {
  try {
    const { dni } = req.params;
    const result = await pool.query(
      'SELECT *, COALESCE(limite_credito, 50000) AS limite_credito FROM clientes WHERE dni = $1',
      [dni]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  try {
    const { dni, nombre_apellido, telefono, email, domicilio, tipo, limite_credito } = req.body;

    const existe = await pool.query('SELECT dni FROM clientes WHERE dni = $1', [dni]);
    if (existe.rows.length > 0)
      return res.status(409).json({ error: 'Ya existe un cliente con ese DNI' });

    const limiteVal = tipo === 'Cuenta corriente' && limite_credito != null
      ? parseFloat(limite_credito)
      : 50000;

    const result = await pool.query(
      `INSERT INTO clientes (dni, nombre_apellido, telefono, email, domicilio, tipo, limite_credito)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [dni, nombre_apellido, telefono ?? null, email ?? null, domicilio ?? null,
       tipo ?? 'Normal', limiteVal]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const modificar = async (req, res) => {
  try {
    const { dni } = req.params;
    const { nombre_apellido, telefono, email, domicilio, tipo, limite_credito } = req.body;

    const result = await pool.query(
      `UPDATE clientes SET
        nombre_apellido = COALESCE($1, nombre_apellido),
        telefono        = COALESCE($2, telefono),
        email           = COALESCE($3, email),
        domicilio       = COALESCE($4, domicilio),
        tipo            = COALESCE($5, tipo),
        limite_credito  = CASE WHEN $6::numeric IS NOT NULL THEN $6::numeric ELSE limite_credito END
       WHERE dni = $7 RETURNING *`,
      [nombre_apellido, telefono, email, domicilio, tipo,
       limite_credito != null ? parseFloat(limite_credito) : null,
       dni]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, obtener, crear, modificar };
