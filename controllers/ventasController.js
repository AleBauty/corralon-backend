const pool = require('../db/connection');
const { crearDeudaEnTransaccion } = require('./cuentaCorrienteController');

const listar = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, c.nombre_apellido AS cliente
      FROM ventas v
      LEFT JOIN clientes c ON v.dni_cliente = c.dni
      ORDER BY v.fecha DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const obtener = async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await pool.query(
      `SELECT v.*,
              c.nombre_apellido AS cliente,
              c.domicilio       AS cliente_domicilio,
              c.telefono        AS cliente_telefono
       FROM ventas v
       LEFT JOIN clientes c ON v.dni_cliente = c.dni
       WHERE v.id = $1`,
      [id]
    );
    if (!venta.rows.length)
      return res.status(404).json({ error: 'Venta no encontrada' });

    const items = await pool.query(
      `SELECT vi.*, p.nombre AS producto
       FROM venta_items vi
       LEFT JOIN productos p ON vi.producto_codigo = p.codigo
       WHERE vi.venta_id = $1 ORDER BY vi.id`,
      [id]
    );
    res.json({ ...venta.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const crear = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      dni_cliente, forma_entrega, direccion_entrega, observaciones, items,
      forma_pago_1, monto_pago_1, forma_pago_2, monto_pago_2,
    } = req.body;

    if (!items || !items.length)
      return res.status(400).json({ error: 'La venta debe tener al menos un item' });

    if (forma_entrega === 'Domicilio' && !direccion_entrega?.trim())
      return res.status(400).json({ error: 'La dirección de entrega es obligatoria para entrega a domicilio' });

    const esCuentaCorriente1 = forma_pago_1 === 'Cuenta corriente';
    const esCuentaCorriente2 = forma_pago_2 === 'Cuenta corriente';
    const esCuentaCorriente  = esCuentaCorriente1 || esCuentaCorriente2;

    if (esCuentaCorriente && !dni_cliente)
      return res.status(400).json({ error: 'Debe seleccionar un cliente para registrar en Cuenta Corriente' });

    await client.query('BEGIN');

    // Calcular total y validar stock
    let total = 0;
    for (const item of items) {
      const prod = await client.query(
        'SELECT stock_actual, precio_venta FROM productos WHERE codigo = $1',
        [item.producto_codigo]
      );
      if (!prod.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ${item.producto_codigo} no encontrado` });
      }
      if (parseFloat(prod.rows[0].stock_actual) < parseFloat(item.cantidad)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Stock insuficiente para ${item.producto_codigo}. Disponible: ${prod.rows[0].stock_actual}`,
        });
      }
      item.precio_unitario = item.precio_unitario ?? prod.rows[0].precio_venta;
      item.subtotal = Number(item.precio_unitario) * Number(item.cantidad);
      total += item.subtotal;
    }

    // Montos de pago
    const mp1 = monto_pago_1 != null ? parseFloat(monto_pago_1) : total;
    const mp2 = monto_pago_2 != null ? parseFloat(monto_pago_2) : null;

    const ventaResult = await client.query(
      `INSERT INTO ventas
         (dni_cliente, total, forma_pago, forma_entrega, direccion_entrega, observaciones,
          forma_pago_1, monto_pago_1, forma_pago_2, monto_pago_2)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        dni_cliente ?? null,
        total.toFixed(2),
        forma_pago_1 ?? null,
        forma_entrega ?? null,
        forma_entrega === 'Domicilio' ? (direccion_entrega?.trim() ?? null) : null,
        observaciones ?? null,
        forma_pago_1 ?? null,
        mp1.toFixed(2),
        forma_pago_2 ?? null,
        mp2 != null ? mp2.toFixed(2) : null,
      ]
    );
    const venta = ventaResult.rows[0];

    // Insertar items y descontar stock
    for (const item of items) {
      await client.query(
        `INSERT INTO venta_items (venta_id, producto_codigo, cantidad, precio_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5)`,
        [venta.id, item.producto_codigo, item.cantidad, item.precio_unitario, item.subtotal.toFixed(2)]
      );
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1 WHERE codigo = $2',
        [item.cantidad, item.producto_codigo]
      );
    }

    // Registrar deuda en cuenta corriente (solo el monto CC)
    if (esCuentaCorriente && dni_cliente) {
      const montoCC = esCuentaCorriente1 ? mp1 : (mp2 ?? total);
      await crearDeudaEnTransaccion(client, {
        dni_cliente, venta_id: venta.id, total, monto_cc: montoCC,
      });
    }

    await client.query('COMMIT');
    res.status(201).json({ ...venta, items });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const entregar = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const ventaRes = await client.query('SELECT * FROM ventas WHERE id = $1', [id]);
    if (!ventaRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    if (ventaRes.rows[0].estado === 'Entregada') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La venta ya está marcada como entregada' });
    }

    await client.query("UPDATE ventas SET estado = 'Entregada' WHERE id = $1", [id]);

    const vehiculoId = ventaRes.rows[0].vehiculo_id;
    if (vehiculoId) {
      await client.query("UPDATE vehiculos SET estado = 'Disponible' WHERE id = $1", [vehiculoId]);
    }

    await client.query('COMMIT');
    res.json({ id: parseInt(id), estado: 'Entregada', vehiculo_id: vehiculoId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

module.exports = { listar, obtener, crear, entregar };
