const pool = require('../db/connection');

const listar = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventario_fisico ORDER BY fecha DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const iniciar = async (req, res) => {
  const client = await pool.connect();
  try {
    const { usuario } = req.body;
    const existing = await client.query(
      `SELECT id FROM inventario_fisico WHERE estado = 'En curso'`
    );
    if (existing.rows.length)
      return res.status(409).json({ error: 'Ya hay un inventario en curso' });

    await client.query('BEGIN');

    const invResult = await client.query(
      `INSERT INTO inventario_fisico (usuario) VALUES ($1) RETURNING *`,
      [usuario ?? null]
    );
    const inv = invResult.rows[0];

    const productos = await client.query('SELECT codigo, stock_actual FROM productos ORDER BY codigo');
    for (const p of productos.rows) {
      await client.query(
        `INSERT INTO inventario_items (inventario_id, producto_codigo, stock_sistema, stock_contado)
         VALUES ($1, $2, $3, $3)`,
        [inv.id, p.codigo, parseFloat(p.stock_actual)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(inv);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const obtenerItems = async (req, res) => {
  try {
    const { id } = req.params;
    const inv = await pool.query('SELECT * FROM inventario_fisico WHERE id = $1', [id]);
    if (!inv.rows.length) return res.status(404).json({ error: 'Inventario no encontrado' });
    const items = await pool.query(
      `SELECT ii.*, p.nombre AS producto_nombre, p.unidad_medida
       FROM inventario_items ii
       LEFT JOIN productos p ON ii.producto_codigo = p.codigo
       WHERE ii.inventario_id = $1
       ORDER BY p.nombre`,
      [id]
    );
    res.json({ ...inv.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const actualizarItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { stock_contado } = req.body;
    const result = await pool.query(
      `UPDATE inventario_items SET stock_contado = $1 WHERE id = $2 AND inventario_id = $3 RETURNING *`,
      [parseFloat(stock_contado), itemId, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const finalizar = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { usuario } = req.body;

    const inv = await client.query('SELECT * FROM inventario_fisico WHERE id = $1', [id]);
    if (!inv.rows.length) return res.status(404).json({ error: 'Inventario no encontrado' });
    if (inv.rows[0].estado === 'Finalizado')
      return res.status(409).json({ error: 'El inventario ya fue finalizado' });

    await client.query('BEGIN');

    const items = await client.query(
      'SELECT * FROM inventario_items WHERE inventario_id = $1', [id]
    );

    for (const item of items.rows) {
      const contado  = parseFloat(item.stock_contado);
      const sistema  = parseFloat(item.stock_sistema);
      const diff     = contado - sistema;
      await client.query(
        'UPDATE inventario_items SET diferencia = $1 WHERE id = $2',
        [diff, item.id]
      );
      if (Math.abs(diff) > 0.001) {
        await client.query(
          'UPDATE productos SET stock_actual = $1 WHERE codigo = $2',
          [contado, item.producto_codigo]
        );
        await client.query(
          `INSERT INTO movimientos_stock
             (producto_codigo, tipo, cantidad, stock_anterior, stock_nuevo, referencia, usuario)
           VALUES ($1, 'Ajuste manual', $2, $3, $4, $5, $6)`,
          [item.producto_codigo, Math.abs(diff).toFixed(2),
           sistema.toFixed(2), contado.toFixed(2), `Inventario #${id}`, usuario ?? null]
        );
      }
    }

    const updated = await client.query(
      `UPDATE inventario_fisico SET estado = 'Finalizado' WHERE id = $1 RETURNING *`, [id]
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

module.exports = { listar, iniciar, obtenerItems, actualizarItem, finalizar };
