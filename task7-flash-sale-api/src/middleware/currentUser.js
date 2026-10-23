const users = require('../services/users.service');
const AppError = require('../utils/AppError');
const { parseId } = require('../validators');

// Simplified identification: the customer id is sent in the X-User-Id header.
// (Swap for the JWT middleware of the Auth API task to get real authentication.)
module.exports = (req, _res, next) => {
  const id = parseId(req.get('X-User-Id'));
  const user = id && users.findById(id);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Missing or unknown X-User-Id header. Create a customer with POST /api/users first.');
  req.user = user;
  next();
};
