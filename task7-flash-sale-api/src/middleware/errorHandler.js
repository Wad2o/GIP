const config = require('../config');
const AppError = require('../utils/AppError');

const notFound = (req, _res, next) => next(new AppError(404, 'ROUTE_NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));

// Every error leaves as { error: { status, code, message, details? } }.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let { status, code, message, details } = err;
  if (err.type === 'entity.parse.failed') { status = 400; code = 'MALFORMED_JSON'; message = 'Malformed JSON body'; }
  else if (err.type === 'entity.too.large') { status = 413; code = 'BODY_TOO_LARGE'; message = 'Request body too large'; }
  else if (!(err instanceof AppError)) {
    status = 500; code = 'INTERNAL_ERROR'; message = 'Internal server error';
    if (config.NODE_ENV !== 'test') console.error(err);
  }
  res.status(status).json({ error: { status, code, message, ...(details && { details }) } });
};

module.exports = { notFound, errorHandler };
