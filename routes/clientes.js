const express = require('express');
const router = express.Router();
const controller = require('../controllers/clientesController');

router.get('/',                          controller.listar);
router.get('/:dni/historial-compras',    controller.historialCompras);
router.get('/:dni',                      controller.obtener);
router.post('/',                         controller.crear);
router.put('/:dni',                      controller.modificar);

module.exports = router;
