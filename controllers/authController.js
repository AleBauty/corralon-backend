const pool = require('../db/connection');

const login = async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario?.trim() || !password)
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });

    const result = await pool.query(
      `SELECT id, nombre, usuario, rol
       FROM usuarios
       WHERE usuario = $1 AND password = $2 AND estado = 'Activo'`,
      [usuario.trim(), password]
    );

    if (!result.rows.length)
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { login };
