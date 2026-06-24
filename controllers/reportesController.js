const pool = require('../db/connection');

const ventasPeriodo = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta)
      return res.status(400).json({ error: 'desde y hasta son obligatorios' });

    const result = await pool.query(
      `SELECT v.id, v.fecha, v.total, v.forma_pago, v.forma_entrega, v.estado,
              c.nombre_apellido AS cliente
       FROM ventas v
       LEFT JOIN clientes c ON v.dni_cliente = c.dni
       WHERE DATE(v.fecha) BETWEEN $1 AND $2
       ORDER BY v.fecha`,
      [desde, hasta]
    );

    const totalFacturado = result.rows.reduce((acc, v) => acc + parseFloat(v.total || 0), 0);

    const ventasPorDia = {};
    result.rows.forEach(v => {
      const d = String(v.fecha).substring(0, 10);
      ventasPorDia[d] = (ventasPorDia[d] || 0) + parseFloat(v.total || 0);
    });

    res.json({
      ventas:           result.rows,
      total_facturado:  parseFloat(totalFacturado.toFixed(2)),
      cantidad_ventas:  result.rows.length,
      ventas_por_dia:   Object.entries(ventasPorDia)
        .map(([fecha, total]) => ({ fecha, total: parseFloat(total.toFixed(2)) }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const productosMasVendidos = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vi.producto_codigo,
              COALESCE(p.nombre, vi.producto_codigo) AS nombre,
              SUM(vi.cantidad)  AS cantidad_total,
              SUM(vi.subtotal)  AS ingresos_total
       FROM venta_items vi
       LEFT JOIN productos p ON vi.producto_codigo = p.codigo
       GROUP BY vi.producto_codigo, p.nombre
       ORDER BY cantidad_total DESC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const asistenciasPeriodo = async (req, res) => {
  try {
    const { dni, desde, hasta } = req.query;
    const conds = [];
    const vals  = [];

    if (dni)   { vals.push(dni);   conds.push(`a.dni_empleado = $${vals.length}`); }
    if (desde) { vals.push(desde); conds.push(`a.fecha >= $${vals.length}`); }
    if (hasta) { vals.push(hasta); conds.push(`a.fecha <= $${vals.length}`); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT a.*, e.nombre AS empleado
       FROM asistencias a
       LEFT JOIN empleados e ON a.dni_empleado = e.dni
       ${where}
       ORDER BY a.fecha DESC, e.nombre`,
      vals
    );

    const totalHoras   = result.rows.reduce((acc, a) => acc + parseFloat(a.horas_trabajadas || 0), 0);
    const diasUnicos   = new Set(result.rows.map(a => String(a.fecha).substring(0, 10))).size;
    const empUnicos    = new Set(result.rows.map(a => a.dni_empleado)).size;

    res.json({
      asistencias:     result.rows,
      total_horas:     parseFloat(totalHoras.toFixed(2)),
      dias_trabajados: diasUnicos,
      empleados_count: empUnicos,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const stockCritico = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
              cat.nombre   AS categoria_nombre,
              prov.nombre  AS proveedor_nombre,
              ROUND(p.stock_actual - p.stock_minimo, 2) AS diferencia
       FROM productos p
       LEFT JOIN categorias_producto cat  ON p.categoria_id = cat.id
       LEFT JOIN proveedores prov         ON p.proveedor_principal = prov.cuit
       WHERE p.stock_actual <= p.stock_minimo
       ORDER BY diferencia ASC, p.nombre`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const rentabilidadProductos = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vi.producto_codigo,
              COALESCE(p.nombre, vi.producto_codigo) AS nombre,
              p.precio_costo,
              p.porcentaje_ganancia,
              ROUND(p.precio_costo * (1 + COALESCE(p.porcentaje_ganancia,0) / 100), 2) AS precio_venta,
              SUM(vi.cantidad)  AS cantidad_vendida,
              SUM(vi.subtotal)  AS ingresos_total,
              ROUND(SUM(vi.subtotal) - SUM(vi.cantidad * COALESCE(p.precio_costo,0)), 2) AS ganancia_total
       FROM venta_items vi
       LEFT JOIN productos p ON vi.producto_codigo = p.codigo
       GROUP BY vi.producto_codigo, p.nombre, p.precio_costo, p.porcentaje_ganancia
       ORDER BY ganancia_total DESC NULLS LAST`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const rankingClientes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.dni_cliente,
              COALESCE(c.nombre_apellido, v.dni_cliente) AS cliente,
              COUNT(v.id)   AS cantidad_compras,
              SUM(v.total)  AS total_comprado
       FROM ventas v
       LEFT JOIN clientes c ON v.dni_cliente = c.dni
       WHERE v.dni_cliente IS NOT NULL
       GROUP BY v.dni_cliente, c.nombre_apellido
       ORDER BY total_comprado DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const reporteDeudores = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cc.dni_cliente,
              COALESCE(c.nombre_apellido, cc.dni_cliente) AS cliente,
              c.telefono,
              c.limite_credito,
              SUM(cc.saldo)  AS saldo_total,
              MIN(cc.fecha)  AS deuda_mas_antigua
       FROM cuenta_corriente cc
       LEFT JOIN clientes c ON cc.dni_cliente = c.dni
       WHERE cc.saldo > 0
       GROUP BY cc.dni_cliente, c.nombre_apellido, c.telefono, c.limite_credito
       ORDER BY saldo_total DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const stockAlertas = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
              cat.nombre AS categoria_nombre,
              CASE
                WHEN p.stock_actual <= p.stock_minimo                               THEN 'bajo'
                WHEN p.stock_actual <= p.stock_minimo * 1.25 AND p.stock_minimo > 0 THEN 'proximo'
              END AS nivel_alerta
       FROM productos p
       LEFT JOIN categorias_producto cat ON p.categoria_id = cat.id
       WHERE p.stock_minimo > 0 AND p.stock_actual <= p.stock_minimo * 1.25
       ORDER BY p.stock_actual ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  ventasPeriodo, productosMasVendidos, asistenciasPeriodo, stockCritico,
  rentabilidadProductos, rankingClientes, reporteDeudores, stockAlertas,
};
