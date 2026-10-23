const AppError = require('../utils/AppError');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Each validator returns clean values or throws a 400 listing every problem.
function signupInput(body) {
  const { name, email, password } = body || {};
  const errors = [];
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (cleanName.length < 2 || cleanName.length > 60) errors.push({ field: 'name', message: 'name must be 2 to 60 characters' });
  if (!EMAIL.test(cleanEmail) || cleanEmail.length > 254) errors.push({ field: 'email', message: 'email must be a valid email address' });
  // bcrypt only uses the first 72 bytes, so longer passwords are refused instead of silently cut
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
    errors.push({ field: 'password', message: 'password must be 8 characters or more (72 bytes max)' });
  }
  if (errors.length) throw new AppError(400, 'Validation failed', errors);
  return { name: cleanName, email: cleanEmail, password };
}

function loginInput(body) {
  const { email, password } = body || {};
  const errors = [];
  if (typeof email !== 'string' || !email.trim()) errors.push({ field: 'email', message: 'email is required' });
  if (typeof password !== 'string' || !password) errors.push({ field: 'password', message: 'password is required' });
  if (errors.length) throw new AppError(400, 'Validation failed', errors);
  return { email: email.trim().toLowerCase(), password };
}

module.exports = { signupInput, loginInput };
