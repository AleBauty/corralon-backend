const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM egresos ORDER BY fecha DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  try {
    const { concepto, monto, autorizado_por } = req.body;
    if (!concepto?.trim())
      return res.status(400).json({ error: 'El concepto es obligatorio' });
    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0)
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

    const result = await pool.query(
      `INSERT INTO egresos (concepto, monto, autorizado_por)
       VALUES ($1, $2, $3) RETURNING *`,
      [concepto.trim(), parseFloat(monto), autorizado_por ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const autorizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password)
      return res.status(400).json({ error: 'La contraseña es obligatoria' });

    const userCheck = await pool.query(
      `SELECT id FROM usuarios
       WHERE rol = 'gerente_finanzas' AND password = $1 AND estado = 'Activo'`,
      [password]
    );
    if (!userCheck.rows.length)
      return res.status(401).json({ error: 'Contraseña del gerente incorrecta' });

    const result = await pool.query(
      `UPDATE egresos SET estado = 'Autorizado'
       WHERE id = $1 AND estado = 'Pendiente' RETURNING *`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Egreso no encontrado o ya autorizado' });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, crear, autorizar };
