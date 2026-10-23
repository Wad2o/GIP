const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/users.controller');

router.get('/me', auth, controller.me);

module.exports = router;
