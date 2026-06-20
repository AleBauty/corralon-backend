const express = require('express');
const router = express.Router();
const controller = require('../controllers/proveedoresController');

router.get('/', controller.listar);
router.get('/:cuit', controller.obtener);
router.post('/', controller.crear);
router.put('/:cuit', controller.modificar);

module.exports = router;
