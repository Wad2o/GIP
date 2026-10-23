// Demo data: npm run db:seed. Both users have the password "password123".
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log('Database already has users, skipping seed.');
    return;
  }
  const password = await bcrypt.hash('password123', 10);
  const alice = await prisma.user.create({ data: { name: 'Alice', phone: '0550000001', password } });
  const bob = await prisma.user.create({ data: { name: 'Bob', phone: '0550000002', password } });

  await prisma.report.createMany({
    data: [
      { userId: alice.id, itemName: 'Black wallet', type: 'LOST', place: 'Algiers Central Station', date: new Date('2026-10-10'), description: 'Leather, has ID cards' },
      { userId: bob.id, itemName: 'Blue umbrella', type: 'FOUND', place: 'Bab Ezzouar', date: new Date('2026-10-12') },
      { userId: alice.id, itemName: 'House keys', type: 'FOUND', place: 'Oran', date: new Date('2026-10-15'), description: 'Three keys on a red ring' },
      { userId: bob.id, itemName: 'Silver phone', type: 'LOST', place: 'Hydra', date: new Date('2026-10-16'), status: 'RECOVERED' },
    ],
  });
  console.log('Seeded 2 users and 4 reports.');
}

main().finally(() => prisma.$disconnect());
