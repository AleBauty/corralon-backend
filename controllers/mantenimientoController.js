const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const { vehiculo_id } = req.query;
    const cond = vehiculo_id ? 'WHERE m.vehiculo_id = $1' : '';
    const vals = vehiculo_id ? [vehiculo_id] : [];
    const result = await pool.query(
      `SELECT m.*, v.patente, v.marca, v.modelo, v.kilometraje_actual
       FROM mantenimiento_vehiculos m
       LEFT JOIN vehiculos v ON m.vehiculo_id = v.id
       ${cond}
       ORDER BY m.fecha DESC, m.id DESC`,
      vals
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  const client = await pool.connect();
  try {
    const { vehiculo_id, tipo, descripcion, fecha, costo, kilometraje, proximo_service, estado } = req.body;
    if (!vehiculo_id)
      return res.status(400).json({ error: 'El vehículo es obligatorio' });

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO mantenimiento_vehiculos
         (vehiculo_id, tipo, descripcion, fecha, costo, kilometraje, proximo_service, estado)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7, $8)
       RETURNING *`,
      [
        vehiculo_id,
        tipo           || null,
        descripcion    || null,
        fecha          || null,
        costo          ? parseFloat(costo)          : null,
        kilometraje    ? parseInt(kilometraje, 10)  : null,
        proximo_service ? parseInt(proximo_service, 10) : null,
        estado         || 'Realizado',
      ]
    );

    // Actualizar kilometraje_actual del vehículo si el ingresado es mayor al registrado
    if (kilometraje) {
      await client.query(
        `UPDATE vehiculos
         SET kilometraje_actual = $1
         WHERE id = $2
           AND (kilometraje_actual IS NULL OR kilometraje_actual < $1)`,
        [parseInt(kilometraje, 10), vehiculo_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

module.exports = { listar, crear };
