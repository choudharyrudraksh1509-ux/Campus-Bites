/**
 * Deterministic Synthetic Data Generator for Campus Bites Performance Benchmarks
 * 
 * Generates 500+ users, 11+ shops, 2,500+ orders, order items, reviews, and autobook schedules.
 * Uses a deterministic PRNG (Mulberry32) with a fixed seed for 100% reproducible benchmarks.
 * All benchmark records are safely tagged with benchmark identifiers for zero-impact staging cleanup.
 * 
 * Usage:
 *   npx tsx scripts/benchmark/seed-benchmark.ts [--seed 424242] [--users 520] [--orders 2500]
 *   npx tsx scripts/benchmark/seed-benchmark.ts --clean
 */

import prisma from '../../src/db/prisma';

// Mulberry32 deterministic 32-bit PRNG
function mulberry32(seed: number) {
    let s = seed >>> 0;
    return function () {
        let t = (s += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const FIRST_NAMES = [
    'Aarav', 'Aditi', 'Advait', 'Ananya', 'Arjun', 'Bhavya', 'Chetan', 'Deepak',
    'Dev', 'Divya', 'Gaurav', 'Harsh', 'Ishaan', 'Karan', 'Kavya', 'Manish',
    'Meera', 'Neha', 'Nikhil', 'Pooja', 'Pranav', 'Priya', 'Rahul', 'Rhea',
    'Rohan', 'Rohit', 'Sahil', 'Samyak', 'Shiv', 'Shreya', 'Siddharth', 'Sneha',
    'Tanmay', 'Tarun', 'Utkarsh', 'Varun', 'Vidya', 'Vikram', 'Yash', 'Zoya'
];

const LAST_NAMES = [
    'Sharma', 'Verma', 'Gupta', 'Mehta', 'Patel', 'Iyer', 'Nair', 'Reddy',
    'Rao', 'Kumar', 'Singh', 'Joshi', 'Mishra', 'Choudhury', 'Bose', 'Das',
    'Sen', 'Agarwal', 'Bansal', 'Chatterjee', 'Deshmukh', 'Kulkarni', 'Pillai'
];

const REVIEW_COMMENTS = [
    'Crispy and fresh, loved the quick takeaway service!',
    'Great value for money, portion size was very generous.',
    'Piping hot food, picked up in under 5 minutes.',
    'Flavors were on point, best snack spot on campus.',
    'Quality is consistent every single time.',
    'Good taste but counter was a bit crowded during lunch.',
    'Excellent taste and authentic spices. Highly recommended!',
    'Loved the drink combo, very refreshing after evening classes.',
    'Decent meal, quick token handover.',
    'Super fast preparation and friendly stall staff.'
];

const BENCHMARK_EMAIL_DOMAIN = 'benchmark.campusbites.internal';
const PRECOMPUTED_BCRYPT_HASH = '$2b$10$t04LNSD8BOeDQES/EfBLfuIi9IENndoszMR7kqsbfbW3G.Mt.vd1O'; // 'Student@123'

export async function cleanupBenchmarkData() {
    console.log('🧹 Cleaning up any existing benchmark synthetic data...');

    // 1. Delete benchmark autobook schedules
    const deletedSchedules = await prisma.autobookSchedule.deleteMany({
        where: { user: { email: { endsWith: `@${BENCHMARK_EMAIL_DOMAIN}` } } }
    });

    // 2. Delete benchmark reviews
    const deletedReviews = await prisma.review.deleteMany({
        where: {
            OR: [
                { customer: { email: { endsWith: `@${BENCHMARK_EMAIL_DOMAIN}` } } },
                { order: { idempotencyKey: { startsWith: 'bench-ord-' } } }
            ]
        }
    });

    // 3. Delete benchmark orders (cascades to OrderItem & PaymentAttempt)
    const deletedOrders = await prisma.order.deleteMany({
        where: { idempotencyKey: { startsWith: 'bench-ord-' } }
    });

    // 4. Delete benchmark food items
    const deletedItems = await prisma.foodItem.deleteMany({
        where: { name: { startsWith: 'Bench Item' } }
    });

    // 5. Delete benchmark shops
    const deletedShops = await prisma.shop.deleteMany({
        where: { name: { startsWith: 'Benchmark ' } }
    });

    // 6. Delete benchmark user roles
    await prisma.userRole.deleteMany({
        where: { user: { email: { endsWith: `@${BENCHMARK_EMAIL_DOMAIN}` } } }
    });

    // 7. Delete benchmark users
    const deletedUsers = await prisma.user.deleteMany({
        where: { email: { endsWith: `@${BENCHMARK_EMAIL_DOMAIN}` } }
    });

    console.log(`✅ Cleanup complete:
    - Orders removed: ${deletedOrders.count}
    - Reviews removed: ${deletedReviews.count}
    - Schedules removed: ${deletedSchedules.count}
    - Food items removed: ${deletedItems.count}
    - Shops removed: ${deletedShops.count}
    - Users removed: ${deletedUsers.count}`);
}

export async function seedBenchmarkData(options?: {
    seed?: number;
    userCount?: number;
    orderCount?: number;
}) {
    const seed = options?.seed ?? 424242;
    const targetUserCount = options?.userCount ?? 520;
    const targetOrderCount = options?.orderCount ?? 2500;

    console.log(`\n======================================================`);
    console.log(`🌱 SEEDING SYNTHETIC BENCHMARK DATASET`);
    console.log(`   Deterministic Seed: ${seed}`);
    console.log(`   Target Users:       ${targetUserCount}`);
    console.log(`   Target Orders:      ${targetOrderCount}`);
    console.log(`======================================================`);

    const rand = mulberry32(seed);
    const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
    const randChoice = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
    const randFloat = (min: number, max: number) => min + rand() * (max - min);

    // 1. Ensure clean slate for benchmark tags
    await cleanupBenchmarkData();

    // 2. Fetch baseline metadata (roles, categories, areas)
    const roleCustomer = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
    if (!roleCustomer) throw new Error('CUSTOMER role not found in database');

    const area = await prisma.area.findFirst();
    if (!area) throw new Error('No area found in database');

    const categories = await prisma.category.findMany();
    if (categories.length === 0) throw new Error('No categories found in database');

    const defaultOwner = await prisma.user.findFirst({
        where: { roles: { some: { role: { name: { in: ['OWNER', 'ADMIN'] } } } } }
    }) || await prisma.user.findFirst();

    if (!defaultOwner) throw new Error('No owner or admin user found');

    // 3. Ensure 11+ shops exist
    let existingShops = await prisma.shop.findMany({ include: { items: true } });
    if (existingShops.length < 11) {
        console.log(`🏪 Creating benchmark shops to reach target outlet count (current: ${existingShops.length})...`);
        const needed = 11 - existingShops.length;
        const newShopsData = [
            { name: 'Benchmark Night Canteen', areaId: area.id, ownerId: defaultOwner.id, status: 'ACTIVE' },
            { name: 'Benchmark Coffee Bar', areaId: area.id, ownerId: defaultOwner.id, status: 'ACTIVE' },
            { name: 'Benchmark Kathi Hub', areaId: area.id, ownerId: defaultOwner.id, status: 'ACTIVE' }
        ].slice(0, needed);

        for (const sData of newShopsData) {
            const created = await prisma.shop.create({
                data: sData
            });
            // Add items for new shop
            const itemsToCreate = [
                { shopId: created.id, categoryId: categories[0].id, name: `Bench Item Hot Beverage #${created.id}`, price: 20 },
                { shopId: created.id, categoryId: categories[1]?.id || categories[0].id, name: `Bench Item Snack Platter #${created.id}`, price: 65 },
                { shopId: created.id, categoryId: categories[2]?.id || categories[0].id, name: `Bench Item Special Roll #${created.id}`, price: 95 },
                { shopId: created.id, categoryId: categories[3]?.id || categories[0].id, name: `Bench Item Chef Meal #${created.id}`, price: 140 }
            ];
            await prisma.foodItem.createMany({ data: itemsToCreate });
        }
        existingShops = await prisma.shop.findMany({ include: { items: true } });
    }
    console.log(`✅ Available Shops: ${existingShops.length}`);

    // Flatten all active food items by shop
    const shopItemsMap = new Map<number, { id: number; name: string; price: number }[]>();
    for (const sh of existingShops) {
        const items = await prisma.foodItem.findMany({
            where: { shopId: sh.id, isAvailable: true },
            select: { id: true, name: true, price: true }
        });
        if (items.length > 0) {
            shopItemsMap.set(sh.id, items);
        }
    }

    // 4. Batch Create 500+ Benchmark Users
    console.log(`👥 Generating ${targetUserCount} deterministic benchmark users...`);
    const usersBatch = [];
    const basePhone = 9800000000;

    for (let i = 1; i <= targetUserCount; i++) {
        const fn = FIRST_NAMES[(i * 7 + seed) % FIRST_NAMES.length];
        const ln = LAST_NAMES[(i * 13 + seed) % LAST_NAMES.length];
        const fullName = `${fn} ${ln}`;
        const email = `bench.student.${i}@${BENCHMARK_EMAIL_DOMAIN}`;
        const phone = String(basePhone + i);

        usersBatch.push({
            fullName,
            email,
            phone,
            passwordHash: PRECOMPUTED_BCRYPT_HASH,
            isActive: true,
            createdAt: new Date(Date.now() - (30 * 24 * 3600 * 1000) + (i * 3600 * 1000))
        });
    }

    // Insert users in chunks of 200
    const CHUNK_SIZE = 200;
    for (let c = 0; c < usersBatch.length; c += CHUNK_SIZE) {
        await prisma.user.createMany({
            data: usersBatch.slice(c, c + CHUNK_SIZE)
        });
    }

    // Fetch created benchmark users
    const benchmarkUsers = await prisma.user.findMany({
        where: { email: { endsWith: `@${BENCHMARK_EMAIL_DOMAIN}` } },
        select: { id: true, fullName: true, email: true },
        orderBy: { id: 'asc' }
    });

    console.log(`✅ Inserted ${benchmarkUsers.length} benchmark users. Assigning CUSTOMER roles...`);

    // Assign CUSTOMER role to all benchmark users
    const roleBatch = benchmarkUsers.map(u => ({
        userId: u.id,
        roleId: roleCustomer.id
    }));
    for (let c = 0; c < roleBatch.length; c += CHUNK_SIZE) {
        await prisma.userRole.createMany({
            data: roleBatch.slice(c, c + CHUNK_SIZE),
            skipDuplicates: true
        });
    }

    // 5. Generate 2,500+ Orders deterministically
    console.log(`📦 Generating ${targetOrderCount} realistic orders...`);
    const eligibleShopIds = Array.from(shopItemsMap.keys());
    const paymentMethods = ['UPI', 'ONLINE_DEMO', 'RAZORPAY_DEMO', 'CASH', 'NET_BANKING_DEMO'];
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 3600 * 1000;

    const ordersBatch = [];
    const plannedOrderItems: { orderIndex: number; itemId: number; quantity: number; price: number }[] = [];

    for (let i = 1; i <= targetOrderCount; i++) {
        const customer = benchmarkUsers[randInt(0, benchmarkUsers.length - 1)];
        const shopId = randChoice(eligibleShopIds);
        const shopItems = shopItemsMap.get(shopId)!;

        // Realistic status distribution
        const pStatus = rand();
        let status = 'COMPLETED';
        if (pStatus < 0.05) status = 'CANCELLED';
        else if (pStatus < 0.10) status = 'READY';
        else if (pStatus < 0.18) status = 'PREPARING';
        else if (pStatus < 0.28) status = 'PLACED';

        // Deterministic order timestamp: spread across 30 days, clustered in lunch/dinner
        const ageOffset = Math.floor(rand() * thirtyDaysMs);
        const orderDate = new Date(now - ageOffset);
        // adjust hour towards 12-14 or 17-21
        const peakHour = rand() < 0.4 ? randInt(12, 14) : (rand() < 0.7 ? randInt(17, 21) : randInt(8, 22));
        orderDate.setHours(peakHour, randInt(0, 59), randInt(0, 59));

        // Select 1 to 3 items
        const numItems = randInt(1, 3);
        let calculatedTotal = 0;
        const selectedItems = [];

        for (let j = 0; j < numItems; j++) {
            const item = randChoice(shopItems);
            const qty = randInt(1, 2);
            calculatedTotal += item.price * qty;
            selectedItems.push({
                orderIndex: i - 1,
                itemId: item.id,
                quantity: qty,
                price: item.price
            });
        }

        plannedOrderItems.push(...selectedItems);

        ordersBatch.push({
            customerId: customer.id,
            shopId: shopId,
            status,
            totalAmount: calculatedTotal,
            orderTime: orderDate,
            isPreorder: rand() < 0.15,
            pickupTime: rand() < 0.15 ? '13:30' : null,
            estimatedMinutes: randInt(8, 20),
            queueNumber: randInt(1, 25),
            paymentMethod: randChoice(paymentMethods),
            idempotencyKey: `bench-ord-${seed}-${i}`
        });
    }

    // Insert orders in batches of 250
    const ORDER_CHUNK = 250;
    for (let c = 0; c < ordersBatch.length; c += ORDER_CHUNK) {
        await prisma.order.createMany({
            data: ordersBatch.slice(c, c + ORDER_CHUNK)
        });
    }

    // Fetch created orders to get actual database IDs
    const createdOrders = await prisma.order.findMany({
        where: { idempotencyKey: { startsWith: `bench-ord-${seed}-` } },
        select: { id: true, customerId: true, shopId: true, status: true, totalAmount: true, orderTime: true },
        orderBy: { id: 'asc' }
    });

    console.log(`✅ Inserted ${createdOrders.length} orders. Creating order items and payment attempts...`);

    // Map order items to DB order IDs
    const dbOrderItems = plannedOrderItems.map(poi => ({
        orderId: createdOrders[poi.orderIndex].id,
        itemId: poi.itemId,
        quantity: poi.quantity,
        priceAtOrder: poi.price
    }));

    for (let c = 0; c < dbOrderItems.length; c += 500) {
        await prisma.orderItem.createMany({
            data: dbOrderItems.slice(c, c + 500)
        });
    }

    // Create payment attempts for orders
    const paymentsBatch = createdOrders.map(o => ({
        orderId: o.id,
        amount: o.totalAmount,
        status: o.status === 'CANCELLED' ? 'FAILED' : 'SUCCESS',
        attemptTime: o.orderTime
    }));

    for (let c = 0; c < paymentsBatch.length; c += 500) {
        await prisma.paymentAttempt.createMany({
            data: paymentsBatch.slice(c, c + 500)
        });
    }

    // 6. Generate 600+ Reviews for completed orders
    console.log(`⭐ Generating 600+ customer reviews...`);
    const completedOrders = createdOrders.filter(o => o.status === 'COMPLETED');
    const reviewsBatch = [];
    const targetReviewCount = Math.min(650, completedOrders.length);

    for (let i = 0; i < targetReviewCount; i++) {
        const ord = completedOrders[i];
        const rating = rand() < 0.65 ? 5 : (rand() < 0.85 ? 4 : (rand() < 0.95 ? 3 : 2));
        const comment = randChoice(REVIEW_COMMENTS);
        const reviewDate = new Date(ord.orderTime.getTime() + randInt(15, 120) * 60 * 1000);

        reviewsBatch.push({
            orderId: ord.id,
            customerId: ord.customerId,
            shopId: ord.shopId,
            rating,
            comment,
            createdAt: reviewDate
        });
    }

    for (let c = 0; c < reviewsBatch.length; c += 300) {
        await prisma.review.createMany({
            data: reviewsBatch.slice(c, c + 300)
        });
    }

    // 7. Generate Autobook Schedules
    console.log(`⏰ Generating 150 daily autobook recurring schedules...`);
    const schedulesBatch = [];
    const scheduledTimes = ['08:30', '11:45', '13:00', '17:15', '19:30', '21:15'];

    for (let i = 0; i < 150; i++) {
        const user = benchmarkUsers[i % benchmarkUsers.length];
        const shopId = randChoice(eligibleShopIds);
        const shopItems = shopItemsMap.get(shopId)!;
        const item = randChoice(shopItems);

        schedulesBatch.push({
            userId: user.id,
            shopId: shopId,
            itemId: item.id,
            quantity: randInt(1, 2),
            scheduledTime: randChoice(scheduledTimes),
            isActive: rand() > 0.2,
            lastRunDate: rand() > 0.5 ? '2026-10-23' : null,
            createdAt: new Date(Date.now() - randInt(1, 20) * 86400 * 1000)
        });
    }

    await prisma.autobookSchedule.createMany({
        data: schedulesBatch
    });

    console.log(`======================================================`);
    console.log(`🎉 BENCHMARK DATASET GENERATION COMPLETE`);
    console.log(`   - Users:              ${benchmarkUsers.length}`);
    console.log(`   - Orders:             ${createdOrders.length}`);
    console.log(`   - Order Items:        ${dbOrderItems.length}`);
    console.log(`   - Payment Attempts:   ${paymentsBatch.length}`);
    console.log(`   - Reviews:            ${reviewsBatch.length}`);
    console.log(`   - Autobook Schedules: ${schedulesBatch.length}`);
    console.log(`======================================================\n`);
}

// CLI handler
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--clean') || args.includes('--cleanup')) {
        await cleanupBenchmarkData();
        process.exit(0);
    }

    const seedArg = args.indexOf('--seed');
    const seed = seedArg !== -1 && args[seedArg + 1] ? Number(args[seedArg + 1]) : 424242;

    const usersArg = args.indexOf('--users');
    const userCount = usersArg !== -1 && args[usersArg + 1] ? Number(args[usersArg + 1]) : 520;

    const ordersArg = args.indexOf('--orders');
    const orderCount = ordersArg !== -1 && args[ordersArg + 1] ? Number(args[ordersArg + 1]) : 2500;

    try {
        await seedBenchmarkData({ seed, userCount, orderCount });
    } catch (err) {
        console.error('Benchmark seeding failed:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module || process.argv[1]?.includes('seed-benchmark')) {
    main();
}
