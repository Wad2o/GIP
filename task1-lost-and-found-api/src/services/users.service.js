const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

// The current user with all of their reports.
async function getProfile(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      createdAt: true,
      reports: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
    },
  });
  if (!user) throw new AppError(404, 'User not found');
  return user;
}

module.exports = { getProfile };
