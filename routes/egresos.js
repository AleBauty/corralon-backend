const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/egresosController');

router.get('/',             controller.listar);
router.post('/',            controller.crear);
router.put('/:id/autorizar', controller.autorizar);

module.exports = router;
