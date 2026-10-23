const { z } = require('zod');

const phone = z
  .string({ required_error: 'phone is required' })
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, 'phone must be 8 to 15 digits, with an optional leading +');

const register = z.object({
  name: z.string({ required_error: 'name is required' }).trim().min(2, 'name must be at least 2 characters').max(60),
  phone,
  // bcrypt only uses the first 72 bytes
  password: z.string({ required_error: 'password is required' }).min(8, 'password must be at least 8 characters').max(72),
});

const login = z.object({
  phone,
  password: z.string({ required_error: 'password is required' }).min(1, 'password is required'),
});

module.exports = { register, login };
