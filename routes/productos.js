const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/productosController');

router.get('/',                                controller.listar);
router.get('/siguiente-codigo',                controller.siguienteCodigo);
router.get('/categorias',                      controller.listarCategorias);
router.get('/:codigo',                         controller.obtener);
router.post('/',                               controller.crear);
router.put('/:codigo/ingreso-stock',           controller.ingresoStock);
router.get('/:codigo/historial-precios',       controller.historialPrecios);
router.get('/:codigo/movimientos-stock',       controller.movimientosStock);
router.put('/:codigo',                         controller.modificar);

module.exports = router;
