const { z } = require('zod');
const { REPORT_TYPES, REPORT_STATUSES } = require('../constants');
const { optionalText, optionalUrl, requiredEnum, optionalEnum, reportDate, emptyToUndefined } = require('./common');

const requiredText = (name, max) =>
  z.string({ required_error: `${name} is required` }).trim().min(1, `${name} is required`).max(max, `${name} must be at most ${max} characters`);

const createItemBody = z.object({
  itemName: requiredText('itemName', 100),
  type: requiredEnum('type', REPORT_TYPES),
  place: requiredText('place', 100),
  date: reportDate(),
  description: optionalText(1000),
  imageUrl: optionalUrl,
});

// Every field optional: only the ones provided (non-null, non-empty) are updated.
const nullableText = (max) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).nullish());

const updateItemBody = z.object({
  itemName: nullableText(100),
  type: optionalEnum('type', REPORT_TYPES),
  place: nullableText(100),
  date: reportDate({ optional: true }),
  description: nullableText(1000),
  imageUrl: optionalUrl,
});

// Date-only filters: "to=2026-10-12" includes the whole day.
const queryDate = (name, { endOfDay = false } = {}) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), `${name} must be a valid date`)
      .transform((s) => {
        const d = new Date(s);
        if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(s)) d.setUTCHours(23, 59, 59, 999);
        return d;
      })
      .optional()
  );

const listItemsQuery = z
  .object({
    q: optionalText(100),
    place: optionalText(100),
    type: optionalEnum('type', REPORT_TYPES),
    status: optionalEnum('status', REPORT_STATUSES),
    from: queryDate('from'),
    to: queryDate('to', { endOfDay: true }),
    userId: z.preprocess(emptyToUndefined, z.coerce.number({ invalid_type_error: 'userId must be a number' }).int().positive().optional()),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1, 'page must be at least 1').default(1)),
    limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100, 'limit must be at most 100').default(20)),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: 'from must be before to', path: ['from'] });

module.exports = { createItemBody, updateItemBody, listItemsQuery };
