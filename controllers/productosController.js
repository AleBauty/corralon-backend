const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.*,
        c.nombre AS categoria_nombre,
        CASE
          WHEN p.stock_actual <= 0              THEN 'Sin stock'
          WHEN p.stock_actual <= p.stock_minimo THEN 'Stock bajo'
          ELSE 'OK'
        END AS estado_stock
      FROM productos p
      LEFT JOIN categorias_producto c ON p.categoria_id = c.id
      ORDER BY p.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const obtener = async (req, res) => {
  try {
    const { codigo } = req.params;
    const result = await pool.query(
      `SELECT
        p.*,
        c.nombre AS categoria_nombre,
        CASE
          WHEN p.stock_actual <= 0              THEN 'Sin stock'
          WHEN p.stock_actual <= p.stock_minimo THEN 'Stock bajo'
          ELSE 'OK'
        END AS estado_stock
       FROM productos p
       LEFT JOIN categorias_producto c ON p.categoria_id = c.id
       WHERE p.codigo = $1`,
      [codigo]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  try {
    const {
      codigo, nombre, descripcion, categoria_id, marca,
      stock_actual, stock_minimo,
      proveedor_principal, proveedor_secundario,
      precio_costo, porcentaje_ganancia,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO productos
        (codigo, nombre, descripcion, categoria_id, marca,
         stock_actual, stock_minimo,
         proveedor_principal, proveedor_secundario,
         precio_costo, porcentaje_ganancia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        codigo, nombre, descripcion ?? null, categoria_id ?? null, marca ?? null,
        stock_actual ?? 0, stock_minimo ?? 0,
        proveedor_principal ?? null, proveedor_secundario ?? null,
        precio_costo, porcentaje_ganancia,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Ya existe un producto con ese código' });
    res.status(500).json({ error: err.message });
  }
};

const modificar = async (req, res) => {
  try {
    const { codigo } = req.params;
    const {
      nombre, descripcion, categoria_id, marca,
      stock_minimo,
      proveedor_principal, proveedor_secundario,
      precio_costo, porcentaje_ganancia,
    } = req.body;

    const result = await pool.query(
      `UPDATE productos SET
        nombre               = COALESCE($1,  nombre),
        descripcion          = COALESCE($2,  descripcion),
        categoria_id         = COALESCE($3,  categoria_id),
        marca                = COALESCE($4,  marca),
        stock_minimo         = COALESCE($5,  stock_minimo),
        proveedor_principal  = COALESCE($6,  proveedor_principal),
        proveedor_secundario = COALESCE($7,  proveedor_secundario),
        precio_costo         = COALESCE($8,  precio_costo),
        porcentaje_ganancia  = COALESCE($9,  porcentaje_ganancia)
       WHERE codigo = $10
       RETURNING *`,
      [
        nombre, descripcion, categoria_id, marca,
        stock_minimo,
        proveedor_principal, proveedor_secundario,
        precio_costo, porcentaje_ganancia,
        codigo,
      ]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Nuevo endpoint: incrementa el stock (no reemplaza)
const ingresoStock = async (req, res) => {
  try {
    const { codigo } = req.params;
    const { cantidad } = req.body;
    if (!cantidad || parseFloat(cantidad) <= 0)
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });

    const result = await pool.query(
      'UPDATE productos SET stock_actual = stock_actual + $1 WHERE codigo = $2 RETURNING *',
      [parseFloat(cantidad), codigo]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, obtener, crear, modificar, ingresoStock };
