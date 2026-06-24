const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*,
             COALESCE(ep.cnt, 0)::int AS entregas_pendientes
      FROM vehiculos v
      LEFT JOIN (
        SELECT vehiculo_id, COUNT(*) AS cnt
        FROM ventas
        WHERE estado = 'Activa'
        GROUP BY vehiculo_id
      ) ep ON ep.vehiculo_id = v.id
      ORDER BY v.patente
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  try {
    const { patente, tipo, marca, modelo, anio, estado, kilometraje_actual } = req.body;
    if (!patente?.trim())
      return res.status(400).json({ error: 'La patente es obligatoria' });

    const result = await pool.query(
      `INSERT INTO vehiculos (patente, tipo, marca, modelo, anio, estado, kilometraje_actual)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [patente.trim().toUpperCase(), tipo ?? null, marca ?? null,
       modelo ?? null, anio ?? null, estado ?? 'Disponible', kilometraje_actual ?? null]
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
    const { tipo, marca, modelo, anio, estado, kilometraje_actual } = req.body;
    const result = await pool.query(
      `UPDATE vehiculos SET tipo=$1, marca=$2, modelo=$3, anio=$4, estado=$5, kilometraje_actual=$6
       WHERE id=$7 RETURNING *`,
      [tipo ?? null, marca ?? null, modelo ?? null, anio ?? null, estado ?? 'Disponible', kilometraje_actual ?? null, id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const ventasPendientes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.id, v.fecha, v.total, v.direccion_entrega,
              v.direccion_calle, v.direccion_nro, v.direccion_ciudad,
              c.nombre_apellido AS cliente, c.telefono AS cliente_telefono,
              c.dni AS cliente_dni, c.domicilio AS cliente_domicilio
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

const entregasPorVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT v.id, v.fecha, v.total, v.direccion_entrega,
              v.direccion_calle, v.direccion_nro, v.direccion_ciudad,
              c.nombre_apellido AS cliente, c.telefono AS cliente_telefono,
              c.dni AS cliente_dni, c.domicilio AS cliente_domicilio,
              COALESCE(
                json_agg(
                  json_build_object('producto', p.nombre, 'cantidad', vi.cantidad)
                  ORDER BY vi.id
                ) FILTER (WHERE vi.id IS NOT NULL),
                '[]'
              ) AS items
       FROM ventas v
       LEFT JOIN clientes c ON v.dni_cliente = c.dni
       LEFT JOIN venta_items vi ON vi.venta_id = v.id
       LEFT JOIN productos p ON p.codigo = vi.producto_codigo
       WHERE v.vehiculo_id = $1 AND v.estado = 'Activa'
       GROUP BY v.id, c.nombre_apellido, c.telefono, c.dni, c.domicilio
       ORDER BY v.fecha DESC`,
      [id]
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
    const { venta_id, venta_ids } = req.body;

    const ids = Array.isArray(venta_ids) && venta_ids.length
      ? venta_ids
      : (venta_id ? [venta_id] : null);

    if (!ids?.length)
      return res.status(400).json({ error: 'Se requiere al menos una venta' });

    await client.query('BEGIN');

    const veh = await client.query('SELECT * FROM vehiculos WHERE id = $1', [id]);
    if (!veh.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    if (veh.rows[0].estado === 'En mantenimiento') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El vehículo está en mantenimiento' });
    }

    for (const vid of ids) {
      await client.query('UPDATE ventas SET vehiculo_id = $1 WHERE id = $2', [id, vid]);
    }

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

const entregarTodas = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE ventas SET estado = 'Entregada', vehiculo_id = NULL
       WHERE vehiculo_id = $1 AND estado = 'Activa'
       RETURNING id`,
      [id]
    );
    await client.query(`UPDATE vehiculos SET estado = 'Disponible' WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ entregadas: result.rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const liberar = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    await client.query(
      `UPDATE ventas SET estado = 'Entregada', vehiculo_id = NULL
       WHERE vehiculo_id = $1 AND estado = 'Activa'`,
      [id]
    );
    const result = await client.query(
      `UPDATE vehiculos SET estado = 'Disponible' WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

module.exports = { listar, crear, modificar, ventasPendientes, entregasPorVehiculo, asignar, entregarTodas, liberar };
