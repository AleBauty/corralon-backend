const express = require('express');
const router = express.Router();
const controller = require('../controllers/asistenciasController');

router.get('/',             controller.listar);
router.post('/entrada',     controller.registrarEntrada);
router.post('/salida',      controller.registrarSalida);

module.exports = router;
