const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/vehiculosController');

router.get('/',                      controller.listar);
router.get('/ventas-pendientes',     controller.ventasPendientes);
router.post('/',                     controller.crear);
router.get('/:id/entregas',          controller.entregasPorVehiculo);
router.put('/:id/asignar',           controller.asignar);
router.put('/:id/entregar-todas',    controller.entregarTodas);
router.put('/:id/liberar',           controller.liberar);
router.put('/:id',                   controller.modificar);

module.exports = router;
