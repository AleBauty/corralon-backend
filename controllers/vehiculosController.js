const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehiculos ORDER BY patente');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  try {
    const { patente, tipo, marca, modelo, anio, estado } = req.body;
    if (!patente?.trim())
      return res.status(400).json({ error: 'La patente es obligatoria' });

    const result = await pool.query(
      `INSERT INTO vehiculos (patente, tipo, marca, modelo, anio, estado)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [patente.trim().toUpperCase(), tipo ?? null, marca ?? null,
       modelo ?? null, anio ?? null, estado ?? 'Disponible']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Ya existe un vehículo con esa patente' });
    res.status(500).json({ error: err.message });
  }
};

const modificar = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, marca, modelo, anio, estado } = req.body;
    const result = await pool.query(
      `UPDATE vehiculos SET tipo=$1, marca=$2, modelo=$3, anio=$4, estado=$5
       WHERE id=$6 RETURNING *`,
      [tipo ?? null, marca ?? null, modelo ?? null, anio ?? null, estado ?? 'Disponible', id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Solo muestra ventas activas con entrega a domicilio sin vehículo asignado
const ventasPendientes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.id, v.fecha, v.total, v.direccion_entrega,
              c.nombre_apellido AS cliente, c.telefono AS cliente_telefono, c.domicilio AS cliente_domicilio
       FROM ventas v
       LEFT JOIN clientes c ON v.dni_cliente = c.dni
       WHERE v.forma_entrega = 'Domicilio'
         AND v.vehiculo_id IS NULL
         AND v.estado = 'Activa'
       ORDER BY v.fecha DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const asignar = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { venta_id } = req.body;
    if (!venta_id)
      return res.status(400).json({ error: 'venta_id es obligatorio' });

    await client.query('BEGIN');

    const veh = await client.query('SELECT * FROM vehiculos WHERE id = $1', [id]);
    if (!veh.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    if (veh.rows[0].estado !== 'Disponible') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `El vehículo está ${veh.rows[0].estado}` });
    }

    await client.query('UPDATE ventas SET vehiculo_id = $1 WHERE id = $2', [id, venta_id]);
    const updated = await client.query(
      `UPDATE vehiculos SET estado = 'En reparto' WHERE id = $1 RETURNING *`,
      [id]
    );
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const liberar = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE vehiculos SET estado = 'Disponible' WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, crear, modificar, ventasPendientes, asignar, liberar };
