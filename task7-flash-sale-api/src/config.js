const path = require('path');

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT !== undefined ? Number(process.env.PORT) : 3000,
  DB_FILE: process.env.DB_FILE || path.join(__dirname, '..', 'data.sqlite'),
  MAX_QUANTITY: Number(process.env.MAX_QUANTITY) || 5, // max units of one product per order
  SEED: process.env.SEED !== 'false',                  // insert demo products when the table is empty
};
