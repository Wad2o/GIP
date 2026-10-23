const config = require('./config');
const AppError = require('./utils/AppError');

const parseId = (v) => (/^\d+$/.test(String(v)) && Number(v) > 0 ? Number(v) : null);

function parseIdParam(v, what) {
  const id = parseId(v);
  if (!id) throw new AppError(400, 'VALIDATION_ERROR', `${what} id must be a positive integer`);
  return id;
}

// The client generates one key per order (e.g. a UUID) and re-sends the SAME key when it retries.
function parseIdempotencyKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
    throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED',
      'Send an Idempotency-Key header (8 to 128 characters: letters, digits, . _ : -), for example a UUID. Re-use the same key when retrying the same order.');
  }
  return key;
}

function parseOrderInput(body) {
  const { productId, quantity = 1 } = body || {};
  const details = [];
  if (!Number.isInteger(productId) || productId < 1) details.push({ field: 'productId', message: 'productId must be a positive integer' });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > config.MAX_QUANTITY) {
    details.push({ field: 'quantity', message: `quantity must be an integer between 1 and ${config.MAX_QUANTITY}` });
  }
  if (details.length) throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', details);
  return { productId, quantity };
}

function parseUserInput(body) {
  const name = typeof (body || {}).name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 60) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', [{ field: 'name', message: 'name must be 2 to 60 characters' }]);
  }
  return { name };
}

module.exports = { parseId, parseIdParam, parseIdempotencyKey, parseOrderInput, parseUserInput };
