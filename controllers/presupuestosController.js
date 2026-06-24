const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
             c.nombre_apellido AS cliente,
             CASE
               WHEN p.estado = 'Vigente' AND p.fecha_vencimiento < NOW() THEN 'Vencido'
               ELSE p.estado
             END AS estado_calculado
      FROM presupuestos p
      LEFT JOIN clientes c ON p.dni_cliente = c.dni
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
    const presup = await pool.query(
      `SELECT p.*,
              c.nombre_apellido AS cliente,
              c.domicilio       AS cliente_domicilio,
              c.telefono        AS cliente_telefono,
              CASE
                WHEN p.estado = 'Vigente' AND p.fecha_vencimiento < NOW() THEN 'Vencido'
                ELSE p.estado
              END AS estado_calculado
       FROM presupuestos p
       LEFT JOIN clientes c ON p.dni_cliente = c.dni
       WHERE p.id = $1`,
      [id]
    );
    if (!presup.rows.length)
      return res.status(404).json({ error: 'Presupuesto no encontrado' });

    const items = await pool.query(
      `SELECT pi.*, prod.nombre AS producto
       FROM presupuesto_items pi
       LEFT JOIN productos prod ON pi.producto_codigo = prod.codigo
       WHERE pi.presupuesto_id = $1 ORDER BY pi.id`,
      [id]
    );
    res.json({ ...presup.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  const client = await pool.connect();
  try {
    const { dni_cliente, observaciones, items, forma_pago_1, monto_pago_1, forma_pago_2, monto_pago_2 } = req.body;

    if (!items || !items.length)
      return res.status(400).json({ error: 'El presupuesto debe tener al menos un producto' });

    await client.query('BEGIN');

    let total = 0;
    for (const item of items) {
      const prod = await client.query(
        'SELECT precio_venta FROM productos WHERE codigo = $1',
        [item.producto_codigo]
      );
      if (!prod.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ${item.producto_codigo} no encontrado` });
      }
      item.precio_unitario = item.precio_unitario ?? prod.rows[0].precio_venta;
      item.subtotal = Number(item.precio_unitario) * Number(item.cantidad);
      total += item.subtotal;
    }

    const result = await client.query(
      `INSERT INTO presupuestos
         (dni_cliente, total, observaciones, fecha_vencimiento,
          forma_pago_1, monto_pago_1, forma_pago_2, monto_pago_2)
       VALUES ($1, $2, $3, NOW() + INTERVAL '5 days', $4, $5, $6, $7)
       RETURNING *`,
      [
        dni_cliente ?? null, total.toFixed(2), observaciones ?? null,
        forma_pago_1 ?? null,
        monto_pago_1 != null ? parseFloat(monto_pago_1) : total,
        forma_pago_2 ?? null,
        monto_pago_2 != null ? parseFloat(monto_pago_2) : null,
      ]
    );
    const presup = result.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO presupuesto_items (presupuesto_id, producto_codigo, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [presup.id, item.producto_codigo, item.cantidad, item.precio_unitario, item.subtotal.toFixed(2)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...presup, items });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const confirmar = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { forma_pago, forma_entrega, direccion_entrega } = req.body ?? {};

    const presup = await client.query('SELECT * FROM presupuestos WHERE id = $1', [id]);
    if (!presup.rows.length)
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    if (presup.rows[0].estado === 'Confirmado')
      return res.status(409).json({ error: 'El presupuesto ya fue confirmado' });

    const pItems = await client.query(
      'SELECT * FROM presupuesto_items WHERE presupuesto_id = $1',
      [id]
    );

    await client.query('BEGIN');

    // Validar stock
    for (const item of pItems.rows) {
      const prod = await client.query(
        'SELECT stock_actual, nombre FROM productos WHERE codigo = $1',
        [item.producto_codigo]
      );
      if (!prod.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ${item.producto_codigo} no encontrado` });
      }
      const disponible = parseFloat(prod.rows[0].stock_actual);
      const solicitado = parseFloat(item.cantidad);
      if (disponible < solicitado) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Stock insuficiente para ${prod.rows[0].nombre} (${item.producto_codigo}): stock disponible ${disponible.toLocaleString('es-AR')}, cantidad solicitada ${solicitado.toLocaleString('es-AR')}`,
        });
      }
    }

    const ventaResult = await client.query(
      `INSERT INTO ventas (dni_cliente, total, forma_pago, forma_entrega, direccion_entrega, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [presup.rows[0].dni_cliente, presup.rows[0].total,
       forma_pago ?? null, forma_entrega ?? null,
       forma_entrega === 'Domicilio' ? (direccion_entrega?.trim() ?? null) : null,
       `Confirmado desde presupuesto #${id}`]
    );
    const venta = ventaResult.rows[0];

    for (const item of pItems.rows) {
      await client.query(
        `INSERT INTO venta_items (venta_id, producto_codigo, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [venta.id, item.producto_codigo, item.cantidad, item.precio_unitario, item.subtotal]
      );
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1 WHERE codigo = $2',
        [item.cantidad, item.producto_codigo]
      );
    }

    await client.query(
      `UPDATE presupuestos SET estado = 'Confirmado' WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ venta, mensaje: `Venta #${venta.id} creada desde presupuesto #${id}` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const editar = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { dni_cliente, observaciones, items, forma_pago_1, monto_pago_1, forma_pago_2, monto_pago_2 } = req.body;

    if (!items || !items.length)
      return res.status(400).json({ error: 'El presupuesto debe tener al menos un producto' });

    const presup = await client.query('SELECT * FROM presupuestos WHERE id = $1', [id]);
    if (!presup.rows.length)
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    if (presup.rows[0].estado !== 'Vigente')
      return res.status(409).json({ error: 'Solo se pueden editar presupuestos en estado Vigente' });

    await client.query('BEGIN');

    let total = 0;
    for (const item of items) {
      const prod = await client.query(
        'SELECT precio_venta FROM productos WHERE codigo = $1',
        [item.producto_codigo]
      );
      if (!prod.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ${item.producto_codigo} no encontrado` });
      }
      item.precio_unitario = item.precio_unitario ?? prod.rows[0].precio_venta;
      item.subtotal = Number(item.precio_unitario) * Number(item.cantidad);
      total += item.subtotal;
    }

    await client.query(
      `UPDATE presupuestos
       SET dni_cliente = $1, observaciones = $2, total = $3,
           forma_pago_1 = $4, monto_pago_1 = $5, forma_pago_2 = $6, monto_pago_2 = $7
       WHERE id = $8`,
      [
        dni_cliente ?? null, observaciones ?? null, total.toFixed(2),
        forma_pago_1 ?? null,
        monto_pago_1 != null ? parseFloat(monto_pago_1) : total,
        forma_pago_2 ?? null,
        monto_pago_2 != null ? parseFloat(monto_pago_2) : null,
        id,
      ]
    );

    await client.query('DELETE FROM presupuesto_items WHERE presupuesto_id = $1', [id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO presupuesto_items (presupuesto_id, producto_codigo, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, item.producto_codigo, item.cantidad, item.precio_unitario, item.subtotal.toFixed(2)]
      );
    }

    await client.query('COMMIT');
    res.json({ id, total: total.toFixed(2), items });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const modificar = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observaciones } = req.body;
    const result = await pool.query(
      `UPDATE presupuestos SET estado = COALESCE($1, estado), observaciones = COALESCE($2, observaciones)
       WHERE id = $3 RETURNING *`,
      [estado, observaciones, id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listar, obtener, crear, confirmar, editar, modificar };
