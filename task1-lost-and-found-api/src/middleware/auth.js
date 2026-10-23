const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/AppError');

// Requires "Authorization: Bearer <token>". Sets req.user = { id, name, phone }.
module.exports = async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, name: true, phone: true },
  });
  if (!user) throw new AppError(401, 'Invalid or expired token');

  req.user = user;
  next();
};
