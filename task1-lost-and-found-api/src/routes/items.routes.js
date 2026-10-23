const router = require('express').Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');
const controller = require('../controllers/items.controller');
const { idParam } = require('../validators/common');
const { createItemBody, updateItemBody, listItemsQuery } = require('../validators/items.validators');

router.get('/', validate({ query: listItemsQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getOne);

// auth runs before upload so anonymous callers can't write files to disk
router.post('/', auth, upload.single('image'), validate({ body: createItemBody }), controller.create);
router.patch('/:id/recover', auth, validate({ params: idParam }), controller.recover);
router.patch('/:id', auth, upload.single('image'), validate({ params: idParam, body: updateItemBody }), controller.update);

module.exports = router;
