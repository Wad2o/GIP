const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const authenticate = require('../middleware/authenticate');
const controller = require('../controllers/auth.controller');

// Slows down password guessing and mass signups.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  message: { error: { status: 429, message: 'Too many attempts, please try again later' } },
});

router.post('/signup', limiter, controller.signup);
router.post('/login', limiter, controller.login);
router.get('/me', authenticate, controller.me);
router.get('/verify', authenticate, controller.verify);

module.exports = router;
