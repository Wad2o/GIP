const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const validate = require('../middleware/validate');
const controller = require('../controllers/auth.controller');
const { register, login } = require('../validators/auth.validators');

// Slows down password guessing.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { status: 429, message: 'Too many attempts, please try again later' } },
});

router.post('/register', limiter, validate({ body: register }), controller.register);
router.post('/login', limiter, validate({ body: login }), controller.login);

module.exports = router;
