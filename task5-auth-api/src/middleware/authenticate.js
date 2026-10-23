const service = require('../services/auth.service');
const AppError = require('../utils/AppError');

// Requires "Authorization: Bearer <token>". Sets req.user and req.tokenPayload.
module.exports = (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Authentication required');
  const { user, payload } = service.authenticate(token);
  req.user = user;
  req.tokenPayload = payload;
  next();
};
