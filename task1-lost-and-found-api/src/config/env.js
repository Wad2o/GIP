require('dotenv').config({ quiet: true });
const path = require('path');

const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'production' ? null : 'dev-only-secret-change-me');
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set when NODE_ENV=production');

module.exports = {
  NODE_ENV,
  PORT: Number(process.env.PORT) || 3000,
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
};
