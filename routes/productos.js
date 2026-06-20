const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/productosController');

router.get('/',                          controller.listar);
router.get('/:codigo',                   controller.obtener);
router.post('/',                         controller.crear);
router.put('/:codigo/ingreso-stock',     controller.ingresoStock);   // ANTES de /:codigo
router.put('/:codigo',                   controller.modificar);

module.exports = router;
