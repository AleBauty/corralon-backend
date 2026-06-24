const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/reportesController');

router.get('/dolar', async (req, res) => {
  try {
    const r = await fetch('https://api.bcra.gob.ar/estadisticas/v3.0/monetarias/1/1');
    const d = await r.json();
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo obtener el tipo de cambio' });
  }
});
router.get('/ventas',                   controller.ventasPeriodo);
router.get('/productos-mas-vendidos',   controller.productosMasVendidos);
router.get('/asistencias',              controller.asistenciasPeriodo);
router.get('/stock-critico',            controller.stockCritico);
router.get('/stock-alertas',            controller.stockAlertas);
router.get('/rentabilidad-productos',   controller.rentabilidadProductos);
router.get('/ranking-clientes',         controller.rankingClientes);
router.get('/deudores',                 controller.reporteDeudores);

module.exports = router;
