import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');
    
    const passwordHash = await bcrypt.hash('password', 10);

    // Users
    const alice = await prisma.user.upsert({
        where: { email: 'alice@vit.edu' },
        update: {},
        create: { fullName: 'Alice Customer', email: 'alice@vit.edu', passwordHash }
    });

    const bob = await prisma.user.upsert({
        where: { email: 'bob@vit.edu' },
        update: {},
        create: { fullName: 'Bob Staff', email: 'bob@vit.edu', passwordHash }
    });

    const charlie = await prisma.user.upsert({
        where: { email: 'charlie@vit.edu' },
        update: {},
        create: { fullName: 'Charlie Owner', email: 'charlie@vit.edu', passwordHash }
    });

    // Area
    const area = await prisma.area.upsert({
        where: { name: 'Food Court 1' },
        update: {},
        create: { name: 'Food Court 1', description: 'Main food court' }
    });

    // Shop
    let shop = await prisma.shop.findFirst({ where: { name: 'FC1 Bites' } });
    if (!shop) {
        shop = await prisma.shop.create({
            data: {
                ownerId: charlie.id,
                areaId: area.id,
                name: 'FC1 Bites',
                status: 'ACTIVE'
            }
        });
    }

    // Category
    const category = await prisma.category.upsert({
        where: { name: 'Fast Food' },
        update: {},
        create: { name: 'Fast Food' }
    });

    // Food Items
    await prisma.foodItem.create({
        data: { shopId: shop.id, categoryId: category.id, name: 'Cheese Burger', price: 80.00, isAvailable: true }
    });
    await prisma.foodItem.create({
        data: { shopId: shop.id, categoryId: category.id, name: 'Cold Coffee', price: 50.00, isAvailable: true }
    });

    console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
