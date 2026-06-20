const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/categoriasEmpleadoController');

router.get('/',     controller.listar);
router.post('/',    controller.crear);
router.put('/:id',  controller.modificar);

module.exports = router;
