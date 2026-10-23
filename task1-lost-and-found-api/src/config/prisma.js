const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSQLite3 } = require('@prisma/adapter-better-sqlite3');
const env = require('./env');

// The Prisma CLI resolves a relative "file:./dev.db" against the prisma/ folder,
// while the driver adapter resolves it against the working directory.
// Resolving it here keeps both pointing at the same file.
function resolveUrl(url) {
  if (!url.startsWith('file:')) return url;
  const file = url.slice('file:'.length);
  return 'file:' + (path.isAbsolute(file) ? file : path.resolve(__dirname, '..', '..', 'prisma', file));
}

const prisma = new PrismaClient({ adapter: new PrismaBetterSQLite3({ url: resolveUrl(env.DATABASE_URL) }) });

module.exports = prisma;
