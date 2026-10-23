const { z } = require('zod');

const DAY_MS = 24 * 60 * 60 * 1000;
const emptyToUndefined = (v) => (v === '' || v === null ? undefined : v);

// Text that may be omitted. Blank strings count as "not provided".
const optionalText = (max) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).transform((v) => v || undefined).optional());

const optionalUrl = z.preprocess(emptyToUndefined, z.string().trim().url('imageUrl must be a valid URL').max(500).optional());

const upper = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v);
const enumError = (name, values) => ({ errorMap: () => ({ message: `${name} must be one of: ${values.join(', ')}` }) });

const requiredEnum = (name, values) => z.preprocess(upper, z.enum(values, enumError(name, values)));
const optionalEnum = (name, values) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : upper(v)), z.enum(values, enumError(name, values)).optional());

// A past (or today's) date. One day of slack covers timezone differences.
const reportDate = ({ optional = false } = {}) => {
  const base = z.coerce
    .date({ errorMap: () => ({ message: 'date must be a valid date' }) })
    .refine((d) => d.getTime() <= Date.now() + DAY_MS, 'date cannot be in the future');
  return z.preprocess(emptyToUndefined, optional ? base.optional() : base);
};

const idParam = z.object({
  id: z.coerce.number({ invalid_type_error: 'id must be a positive integer' }).int().positive('id must be a positive integer'),
});

module.exports = { optionalText, optionalUrl, requiredEnum, optionalEnum, reportDate, idParam, emptyToUndefined };
