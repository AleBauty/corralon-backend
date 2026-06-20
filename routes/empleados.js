const express = require('express');
const router = express.Router();
const controller = require('../controllers/empleadosController');

router.get('/',      controller.listar);
router.get('/:dni',  controller.obtener);
router.post('/',     controller.crear);
router.put('/:dni',  controller.modificar);

module.exports = router;
