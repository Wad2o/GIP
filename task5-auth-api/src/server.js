const app = require('./app');
const config = require('./config');

const server = app.listen(config.PORT, () => console.log(`Auth API running on http://localhost:${config.PORT}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
