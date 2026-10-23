const express = require('express');
const helmet = require('helmet');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
