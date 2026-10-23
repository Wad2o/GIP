const router = require('express').Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/items', require('./items.routes'));

module.exports = router;
