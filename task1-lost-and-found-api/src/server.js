const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

const server = app.listen(env.PORT, () => {
  console.log(`Lost & Found API running on http://localhost:${env.PORT}`);
  console.log(`API docs:            http://localhost:${env.PORT}/api/docs`);
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
