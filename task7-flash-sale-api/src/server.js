const app = require('./app');
const config = require('./config');
const db = require('./db');

const server = app.listen(config.PORT, () => {
  console.log(`Flash Sale API listening on http://localhost:${server.address().port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
