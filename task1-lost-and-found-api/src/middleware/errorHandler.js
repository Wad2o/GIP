const fs = require('fs');
const multer = require('multer');
const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const notFound = (req, _res, next) => next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// Maps every kind of error to { error: { status, message, details? } }.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // Do not keep an uploaded file when the request ended up failing.
  if (req.file) fs.unlink(req.file.path, () => {});

  let status = 500;
  let message = 'Internal server error';
  let details;

  if (err instanceof AppError) {
    ({ status, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller'
      : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Unexpected file field, use "image"'
      : err.message;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    status = 409;
    message = 'Resource already exists';
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    status = 404;
    message = 'Resource not found';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  }

  if (status >= 500 && env.NODE_ENV !== 'test') console.error(err);

  res.status(status).json({ error: { status, message, ...(details && { details }) } });
};

module.exports = { notFound, errorHandler };
