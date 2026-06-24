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
    const { dni, nombre_apellido, telefono, email, domicilio, tipo, limite_credito, codigo_postal, localidad } = req.body;

    const existe = await pool.query('SELECT dni FROM clientes WHERE dni = $1', [dni]);
    if (existe.rows.length > 0)
      return res.status(409).json({ error: 'Ya existe un cliente con ese DNI' });

    const limiteVal = tipo === 'Cuenta corriente' && limite_credito != null
      ? parseFloat(limite_credito)
      : 50000;

    const result = await pool.query(
      `INSERT INTO clientes (dni, nombre_apellido, telefono, email, domicilio, tipo, limite_credito, codigo_postal, localidad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [dni, nombre_apellido, telefono ?? null, email ?? null, domicilio ?? null,
       tipo ?? 'Normal', limiteVal, codigo_postal ?? null, localidad ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const modificar = async (req, res) => {
  try {
    const { dni } = req.params;
    const { nombre_apellido, telefono, email, domicilio, tipo, limite_credito, codigo_postal, localidad } = req.body;

    const result = await pool.query(
      `UPDATE clientes SET
        nombre_apellido = COALESCE($1, nombre_apellido),
        telefono        = COALESCE($2, telefono),
        email           = COALESCE($3, email),
        domicilio       = COALESCE($4, domicilio),
        tipo            = COALESCE($5, tipo),
        limite_credito  = CASE WHEN $6::numeric IS NOT NULL THEN $6::numeric ELSE limite_credito END,
        codigo_postal   = COALESCE($7, codigo_postal),
        localidad       = COALESCE($8, localidad)
       WHERE dni = $9 RETURNING *`,
      [nombre_apellido, telefono, email, domicilio, tipo,
       limite_credito != null ? parseFloat(limite_credito) : null,
       codigo_postal ?? null, localidad ?? null, dni]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const historialCompras = async (req, res) => {
  try {
    const { dni } = req.params;
    const result = await pool.query(
      `SELECT v.id, v.fecha, v.total, v.estado, v.forma_pago_1, v.monto_pago_1,
              v.forma_pago_2, v.monto_pago_2, v.forma_entrega, v.descuento,
              COALESCE(
                json_agg(
                  json_build_object('producto', p.nombre, 'cantidad', vi.cantidad, 'subtotal', vi.subtotal)
                  ORDER BY vi.id
                ) FILTER (WHERE vi.id IS NOT NULL),
                '[]'
              ) AS items
       FROM ventas v
       LEFT JOIN venta_items vi ON vi.venta_id = v.id
       LEFT JOIN productos p ON p.codigo = vi.producto_codigo
       WHERE v.dni_cliente = $1
       GROUP BY v.id
       ORDER BY v.fecha DESC`,
      [dni]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, obtener, crear, modificar, historialCompras };
