const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const reporter = { select: { id: true, name: true, phone: true } };

const create = (userId, data) => prisma.report.create({ data: { ...data, userId } });

// Filters combine with AND. "q" matches the name, description or place.
// (On SQLite, "contains" is case-insensitive for ASCII text.)
async function list({ q, place, type, status, from, to, userId, page, limit }) {
  const where = {
    ...(type && { type }),
    ...(status && { status }),
    ...(userId && { userId }),
    ...(place && { place: { contains: place } }),
    ...((from || to) && { date: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
    ...(q && { OR: [{ itemName: { contains: q } }, { description: { contains: q } }, { place: { contains: q } }] }),
  };

  const [total, items] = await prisma.$transaction([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getDetails(id) {
  const report = await prisma.report.findUnique({ where: { id }, include: { user: reporter } });
  if (!report) throw new AppError(404, 'Item not found');
  const { user, ...rest } = report;
  return { ...rest, reportedBy: user };
}

// 404 if the report doesn't exist, 403 if it belongs to someone else.
async function findOwned(id, userId) {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw new AppError(404, 'Item not found');
  if (report.userId !== userId) throw new AppError(403, 'You can only modify your own reports');
  return report;
}

async function update(id, userId, data) {
  await findOwned(id, userId);
  const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== ''));
  if (!Object.keys(changes).length) throw new AppError(400, 'No updatable fields provided');
  return prisma.report.update({ where: { id }, data: changes });
}

async function markRecovered(id, userId) {
  const report = await findOwned(id, userId);
  if (report.status === 'RECOVERED') throw new AppError(409, 'Item is already marked as recovered');
  return prisma.report.update({ where: { id }, data: { status: 'RECOVERED' } });
}

module.exports = { create, list, getDetails, update, markRecovered };
