const router = require('express').Router();
const users = require('../controllers/users.controller');
const products = require('../controllers/products.controller');
const orders = require('../controllers/orders.controller');
const currentUser = require('../middleware/currentUser');

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.post('/users', users.create);

router.get('/products', products.list);
router.get('/products/:id', products.getOne);
router.get('/products/:id/stock', products.stock);

router.post('/orders', currentUser, orders.create);
router.get('/orders', currentUser, orders.list);
router.get('/orders/:id', currentUser, orders.getOne);

module.exports = router;
