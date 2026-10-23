const config = require('../config');
const AppError = require('../utils/AppError');

const notFound = (req, _res, next) => next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// Every error leaves as { error: { status, message, details? } }.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let { status, message, details } = err;
  if (err.type === 'entity.parse.failed') { status = 400; message = 'Malformed JSON body'; }
  else if (err.type === 'entity.too.large') { status = 413; message = 'Request body too large'; }
  else if (!(err instanceof AppError)) {
    status = 500;
    message = 'Internal server error';
    if (config.NODE_ENV !== 'test') console.error(err);
  }
  if (status === 401) res.set('WWW-Authenticate', 'Bearer');
  res.status(status).json({ error: { status, message, ...(details && { details }) } });
};

module.exports = { notFound, errorHandler };
