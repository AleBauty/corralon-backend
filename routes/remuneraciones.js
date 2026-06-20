const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/remuneracionesController');

router.get('/',              controller.listar);
router.post('/calcular',     controller.calcular);
router.put('/:id/pagar',     controller.pagar);

module.exports = router;
