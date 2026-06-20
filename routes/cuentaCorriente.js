const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/cuentaCorrienteController');

router.get('/clientes',             controller.listarClientes);
router.get('/:dni/movimientos',     controller.listarMovimientos);
router.get('/:dni/deudas',          controller.listarDeudas);
router.post('/pago',                controller.registrarPago);

module.exports = router;
