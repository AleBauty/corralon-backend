const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, pr.nombre AS proveedor
      FROM pedidos p
      LEFT JOIN proveedores pr ON p.proveedor_cuit = pr.cuit
      ORDER BY p.fecha DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const obtener = async (req, res) => {
  try {
    const { id } = req.params;
    const pedido = await pool.query(
      `SELECT p.*, pr.nombre AS proveedor
       FROM pedidos p LEFT JOIN proveedores pr ON p.proveedor_cuit = pr.cuit
       WHERE p.id = $1`,
      [id]
    );
    if (!pedido.rows.length)
      return res.status(404).json({ error: 'Pedido no encontrado' });

    const items = await pool.query(
      `SELECT pi.*, prod.nombre AS producto
       FROM pedido_items pi LEFT JOIN productos prod ON pi.producto_codigo = prod.codigo
       WHERE pi.pedido_id = $1 ORDER BY pi.id`,
      [id]
    );
    res.json({ ...pedido.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  const client = await pool.connect();
  try {
    const { proveedor_cuit, observaciones, items } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });

    await client.query('BEGIN');

    let total = 0;
    for (const item of items) {
      item.subtotal = parseFloat(item.precio_unitario) * parseFloat(item.cantidad);
      total += item.subtotal;
    }

    const result = await client.query(
      `INSERT INTO pedidos (proveedor_cuit, total, observaciones)
       VALUES ($1, $2, $3) RETURNING *`,
      [proveedor_cuit ?? null, total.toFixed(2), observaciones ?? null]
    );
    const pedido = result.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO pedido_items (pedido_id, producto_codigo, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [pedido.id, item.producto_codigo, item.cantidad, item.precio_unitario, item.subtotal.toFixed(2)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...pedido, items });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const recibir = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { items: recibidos } = req.body; // [{ id, cantidad_recibida }]

    const pedido = await client.query('SELECT * FROM pedidos WHERE id = $1', [id]);
    if (!pedido.rows.length)
      return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.rows[0].estado === 'Recibido')
      return res.status(409).json({ error: 'El pedido ya fue recibido' });

    await client.query('BEGIN');

    const items = await client.query(
      'SELECT * FROM pedido_items WHERE pedido_id = $1',
      [id]
    );

    let todosCompletos = true;
    for (const item of items.rows) {
      const rec = recibidos?.find(r => Number(r.id) === Number(item.id));
      const cantRecibida = rec != null ? Math.max(0, parseFloat(rec.cantidad_recibida) || 0) : parseFloat(item.cantidad);

      if (cantRecibida > 0) {
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual + $1 WHERE codigo = $2',
          [cantRecibida, item.producto_codigo]
        );
      }
      if (cantRecibida < parseFloat(item.cantidad)) {
        todosCompletos = false;
      }
    }

    const nuevoEstado = todosCompletos ? 'Recibido' : 'Parcialmente entregado';
    const updated = await client.query(
      `UPDATE pedidos SET estado = $1, fecha_recepcion = NOW() WHERE id = $2 RETURNING *`,
      [nuevoEstado, id]
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

module.exports = { listar, obtener, crear, recibir };
