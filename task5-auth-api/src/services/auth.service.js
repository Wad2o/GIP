const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const store = require('../store');
const AppError = require('../utils/AppError');

// Used when the email is unknown, so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.BCRYPT_ROUNDS);

const toPublic = ({ id, name, email, createdAt }) => ({ id, name, email, createdAt });

function issueToken(user) {
  return jwt.sign({ email: user.email }, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

// Pinning the algorithm blocks "alg: none" and algorithm-confusion tricks.
function verifyToken(token) {
  try {
    return jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw new AppError(401, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
  }
}

async function signup({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);
  // check + create run synchronously together, so two simultaneous signups can't both win
  if (store.findByEmail(email)) throw new AppError(409, 'Email already registered');
  const user = store.create({ name, email, passwordHash });
  return { user: toPublic(user), token: issueToken(user) };
}

async function login({ email, password }) {
  const user = store.findByEmail(email);
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Invalid email or password'); // same message for both cases
  return { user: toPublic(user), token: issueToken(user) };
}

function authenticate(token) {
  const payload = verifyToken(token);
  const user = store.findById(Number(payload.sub));
  if (!user) throw new AppError(401, 'Invalid token');
  return { user: toPublic(user), payload };
}

module.exports = { signup, login, authenticate };
