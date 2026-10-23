const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const publicUser = { id: true, name: true, phone: true, createdAt: true };

const signToken = (userId) => jwt.sign({ sub: String(userId) }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

async function register({ name, phone, password }) {
  if (await prisma.user.findUnique({ where: { phone } })) {
    throw new AppError(409, 'A user with this phone number already exists');
  }
  const user = await prisma.user.create({
    data: { name, phone, password: await bcrypt.hash(password, 10) },
    select: publicUser,
  });
  return { user, token: signToken(user.id) };
}

async function login({ phone, password }) {
  const found = await prisma.user.findUnique({ where: { phone } });
  // Same message for unknown phone and wrong password, so accounts can't be probed.
  if (!found || !(await bcrypt.compare(password, found.password))) {
    throw new AppError(401, 'Invalid phone or password');
  }
  const { password: _hash, ...user } = found;
  return { user, token: signToken(user.id) };
}

module.exports = { register, login };
