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
router.get('/ventas',                 controller.ventasPeriodo);
router.get('/productos-mas-vendidos', controller.productosMasVendidos);
router.get('/asistencias',            controller.asistenciasPeriodo);
router.get('/stock-critico',          controller.stockCritico);

module.exports = router;
