const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/inventarioController');

router.get('/',                         controller.listar);
router.post('/iniciar',                 controller.iniciar);
router.get('/:id',                      controller.obtenerItems);
router.put('/:id/items/:itemId',        controller.actualizarItem);
router.put('/:id/finalizar',            controller.finalizar);

module.exports = router;
