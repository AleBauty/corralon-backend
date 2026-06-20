const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/reportesController');

router.get('/ventas',                 controller.ventasPeriodo);
router.get('/productos-mas-vendidos', controller.productosMasVendidos);
router.get('/asistencias',            controller.asistenciasPeriodo);
router.get('/stock-critico',          controller.stockCritico);

module.exports = router;
