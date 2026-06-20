const express = require('express');
const router = express.Router();
const controller = require('../controllers/pedidosController');

router.get('/', controller.listar);
router.get('/:id', controller.obtener);
router.post('/', controller.crear);
router.put('/:id/recibir', controller.recibir);

module.exports = router;
