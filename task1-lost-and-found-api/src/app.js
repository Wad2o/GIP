const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const routes = require('./routes');
const openapi = require('./docs/openapi');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
// "cross-origin" lets a frontend on another origin display uploaded images.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json({ limit: '100kb' }));

app.use('/uploads', express.static(env.UPLOAD_DIR));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Lost & Found API' }));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
