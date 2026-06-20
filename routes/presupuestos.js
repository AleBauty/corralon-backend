const express = require('express');
const router = express.Router();
const controller = require('../controllers/presupuestosController');

router.get('/',                  controller.listar);
router.get('/:id',               controller.obtener);
router.post('/',                 controller.crear);
router.post('/:id/confirmar',    controller.confirmar);
router.put('/:id/editar',        controller.editar);
router.put('/:id',               controller.modificar);

module.exports = router;
