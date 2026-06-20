const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/vehiculosController');

router.get('/',                    controller.listar);
router.get('/ventas-pendientes',   controller.ventasPendientes);
router.post('/',                   controller.crear);
router.put('/:id/asignar',         controller.asignar);
router.put('/:id/liberar',         controller.liberar);
router.put('/:id',                 controller.modificar);

module.exports = router;
