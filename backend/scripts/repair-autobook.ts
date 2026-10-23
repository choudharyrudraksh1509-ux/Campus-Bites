import prisma from '../src/db/prisma';

async function repair() {
  try {
    console.log('Remapping Autobook mock item IDs to real database food item IDs...');
    await prisma.autobookSchedule.updateMany({ where: { id: { in: [1, 4] } }, data: { itemId: 56 } });
    await prisma.autobookSchedule.update({ where: { id: 2 }, data: { itemId: 57 } });
    await prisma.autobookSchedule.update({ where: { id: 3 }, data: { itemId: 80 } });

    const records = await prisma.autobookSchedule.findMany();
    console.log('Updated Autobook records:', records);
  } catch (err) {
    console.error('Repair error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

repair();
