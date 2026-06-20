const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/ventasController');

router.get('/',             controller.listar);
router.get('/:id',          controller.obtener);
router.post('/',            controller.crear);
router.put('/:id/entregar', controller.entregar);

module.exports = router;
