// validate({ params, query, body }) parses each part with its Zod schema.
// Parsed (coerced, trimmed, defaulted) values land in req.validated.
// A ZodError thrown here is converted to a 400 by the error handler.
const validate = (schemas) => (req, _res, next) => {
  const validated = {};
  for (const part of ['params', 'query', 'body']) {
    if (schemas[part]) validated[part] = schemas[part].parse(req[part] ?? {});
  }
  req.validated = validated;
  next();
};

module.exports = validate;
