const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/mantenimientoController');

router.get('/',  controller.listar);
router.post('/', controller.crear);

module.exports = router;
