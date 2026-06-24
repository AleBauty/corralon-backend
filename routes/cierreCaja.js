const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/cierreCajaController');

router.get('/resumen', controller.resumenDia);
router.post('/cerrar', controller.cerrar);
router.get('/historial', controller.historial);

module.exports = router;
