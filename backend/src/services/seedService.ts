import bcrypt from 'bcryptjs';
import prisma from '../db/prisma';

export interface StallCredential {
    id: number;
    name: string;
    slug: string;
    email: string;
    areaName: string;
    areaDesc: string;
}

export const STALL_CREDENTIALS: StallCredential[] = [
    { 
        id: 1, 
        name: 'Gazebo 1', 
        slug: 'gazebo1', 
        email: 'staff.gazebo1@campusbites.com', 
        areaName: 'Gazebo Complex',
        areaDesc: 'Central campus hotspot with Gazebo 1, Gazebo 2 & Fresh Juices'
    },
    { 
        id: 2, 
        name: 'Gazebo 2', 
        slug: 'gazebo2', 
        email: 'staff.gazebo2@campusbites.com', 
        areaName: 'Gazebo Complex',
        areaDesc: 'Central campus hotspot with Gazebo 1, Gazebo 2 & Fresh Juices'
    },
    { 
        id: 3, 
        name: 'Fresh Juices - Healthy & Tasty', 
        slug: 'freshjuices', 
        email: 'staff.freshjuices@campusbites.com', 
        areaName: 'Gazebo Complex',
        areaDesc: 'Central campus hotspot with Gazebo 1, Gazebo 2 & Fresh Juices'
    },
    { 
        id: 4, 
        name: 'Sri Outlet', 
        slug: 'sri', 
        email: 'staff.sri@campusbites.com', 
        areaName: 'North Square',
        areaDesc: 'North Square food hub featuring Sri, Diner, Bakers & South Corner'
    },
    { 
        id: 5, 
        name: 'North Square Diner', 
        slug: 'nsdiner', 
        email: 'staff.nsdiner@campusbites.com', 
        areaName: 'North Square',
        areaDesc: 'North Square food hub featuring Sri, Diner, Bakers & South Corner'
    },
    { 
        id: 6, 
        name: 'Campus Bakers', 
        slug: 'bakers', 
        email: 'staff.bakers@campusbites.com', 
        areaName: 'North Square',
        areaDesc: 'North Square food hub featuring Sri, Diner, Bakers & South Corner'
    },
    { 
        id: 7, 
        name: 'South Corner', 
        slug: 'southcorner', 
        email: 'staff.southcorner@campusbites.com', 
        areaName: 'North Square',
        areaDesc: 'North Square food hub featuring Sri, Diner, Bakers & South Corner'
    },
    { 
        id: 8, 
        name: 'Hunger Express', 
        slug: 'hunger', 
        email: 'staff.hunger@campusbites.com', 
        areaName: 'Hunger',
        areaDesc: 'Specialist in rolls, burgers, honey chilli potatoes & wraps'
    },
    { 
        id: 9, 
        name: 'Gymkhana Food Club', 
        slug: 'gymkhana', 
        email: 'staff.gymkhana@campusbites.com', 
        areaName: 'Gymkhana',
        areaDesc: 'Authentic Indian Sabzis, Naan, Tandoori Roti & Biryanis'
    },
];

export const DEMO_STUDENTS = [
    { fullName: 'Arjun Sharma', email: 'arjun.sharma@vitstudent.ac.in', phone: '9840123456' },
    { fullName: 'Priya Nair', email: 'priya.nair@vitstudent.ac.in', phone: '9840123457' },
    { fullName: 'Rohit Verma', email: 'rohit.verma@vitstudent.ac.in', phone: '9840123458' },
    { fullName: 'Ananya Iyer', email: 'ananya.iyer@vitstudent.ac.in', phone: '9840123459' },
    { fullName: 'Siddharth M', email: 'siddharth.m@vitstudent.ac.in', phone: '9840123460' },
    { fullName: 'Kavya Reddy', email: 'kavya.reddy@vitstudent.ac.in', phone: '9840123461' },
    { fullName: 'Aditya Patel', email: 'aditya.patel@vitstudent.ac.in', phone: '9840123462' },
    { fullName: 'Sneha Rao', email: 'sneha.rao@vitstudent.ac.in', phone: '9840123463' }
];

let isStallStaffSeedVerified = false;
let seedInFlightPromise: Promise<void> | null = null;

/**
 * Ensures roles, stall staff accounts, admin users, and rich real-time operational data exist.
 * Uses single-flight concurrency lock and fast-path verification to avoid redundant DB round-trips.
 */
export async function ensureStallStaffSeeded(force = false): Promise<void> {
    if (isStallStaffSeedVerified && !force) {
        return;
    }
    if (seedInFlightPromise && !force) {
        return seedInFlightPromise;
    }

    seedInFlightPromise = (async () => {
        try {
            if (!force) {
                const coreEmails = [
                    'admin@campusbites.com',
                    'owner@campusbites.com',
                    ...STALL_CREDENTIALS.map(s => s.email),
                    ...DEMO_STUDENTS.map(st => st.email)
                ];
                const [existingCoreUsers, shopStaffCount] = await Promise.all([
                    prisma.user.count({
                        where: {
                            email: { in: coreEmails },
                            isActive: true,
                            roles: { some: {} }
                        }
                    }),
                    prisma.shopStaff.count()
                ]);

                if (existingCoreUsers >= coreEmails.length && shopStaffCount >= STALL_CREDENTIALS.length) {
                    isStallStaffSeedVerified = true;
                    return;
                }
            }

            const passwordHash = await bcrypt.hash('password123', 10);

            // 1. Ensure Roles
            const [roleStaff, roleCustomer, roleOwner, roleAdmin] = await Promise.all([
                prisma.role.upsert({ where: { name: 'STAFF' }, update: {}, create: { name: 'STAFF' } }),
                prisma.role.upsert({ where: { name: 'CUSTOMER' }, update: {}, create: { name: 'CUSTOMER' } }),
                prisma.role.upsert({ where: { name: 'OWNER' }, update: {}, create: { name: 'OWNER' } }),
                prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } })
            ]);

            // 2. Owner user
            const owner = await prisma.user.upsert({
                where: { email: 'owner@campusbites.com' },
                update: { passwordHash },
                create: {
                    fullName: 'Campus Operations Lead',
                    email: 'owner@campusbites.com',
                    passwordHash
                }
            });
            await prisma.userRole.upsert({
                where: { userId_roleId: { userId: owner.id, roleId: roleOwner.id } },
                update: {},
                create: { userId: owner.id, roleId: roleOwner.id }
            });

            // 3. Tech Admin user (for Tech Team Admin Access)
            const admin = await prisma.user.upsert({
                where: { email: 'admin@campusbites.com' },
                update: { passwordHash, isActive: true },
                create: {
                    fullName: 'Tech Operations Admin',
                    email: 'admin@campusbites.com',
                    phone: '9876543210',
                    passwordHash,
                    isActive: true
                }
            });
            await prisma.userRole.upsert({
                where: { userId_roleId: { userId: admin.id, roleId: roleAdmin.id } },
                update: {},
                create: { userId: admin.id, roleId: roleAdmin.id }
            });

            // 4. Stalls and Mapped Staff
            for (const s of STALL_CREDENTIALS) {
                const area = await prisma.area.upsert({
                    where: { name: s.areaName },
                    update: {},
                    create: { name: s.areaName, description: s.areaDesc }
                });

                let shop = await prisma.shop.findFirst({
                    where: {
                        OR: [
                            { name: s.name },
                            { id: s.id }
                        ]
                    }
                });

                if (!shop) {
                    shop = await prisma.shop.create({
                        data: {
                            name: s.name,
                            ownerId: owner.id,
                            areaId: area.id,
                            status: 'ACTIVE'
                        }
                    });
                } else if (shop.status !== 'ACTIVE') {
                    await prisma.shop.update({
                        where: { id: shop.id },
                        data: { status: 'ACTIVE' }
                    });
                }

                // Create/update staff user
                const staffUser = await prisma.user.upsert({
                    where: { email: s.email },
                    update: {
                        fullName: `${s.name} Staff`,
                        passwordHash,
                        isActive: true
                    },
                    create: {
                        fullName: `${s.name} Staff`,
                        email: s.email,
                        passwordHash,
                        isActive: true
                    }
                });

                // Assign STAFF role
                await prisma.userRole.upsert({
                    where: { userId_roleId: { userId: staffUser.id, roleId: roleStaff.id } },
                    update: {},
                    create: { userId: staffUser.id, roleId: roleStaff.id }
                });

                // Map Staff to this specific Shop in ShopStaff
                await prisma.shopStaff.upsert({
                    where: { shopId_staffId: { shopId: shop.id, staffId: staffUser.id } },
                    update: {},
                    create: { shopId: shop.id, staffId: staffUser.id }
                });
            }

            // 5. Ensure Demo Students exist
            for (const st of DEMO_STUDENTS) {
                const studentUser = await prisma.user.upsert({
                    where: { email: st.email },
                    update: { fullName: st.fullName, phone: st.phone },
                    create: {
                        fullName: st.fullName,
                        email: st.email,
                        phone: st.phone,
                        passwordHash,
                        isActive: true
                    }
                });
                await prisma.userRole.upsert({
                    where: { userId_roleId: { userId: studentUser.id, roleId: roleCustomer.id } },
                    update: {},
                    create: { userId: studentUser.id, roleId: roleCustomer.id }
                });
            }

            // 6. Seed rich realistic orders if count is low
            const existingOrderCount = await prisma.order.count();
            if (existingOrderCount < 35) {
                await seedRealisticCampusOrders();
            }

            isStallStaffSeedVerified = true;
            console.log('✅ Stall staff & admin credentials verified and mapped successfully');
        } catch (error) {
            console.error('Error ensuring stall staff seed:', error);
        } finally {
            seedInFlightPromise = null;
        }
    })();

    return seedInFlightPromise;
}

/**
 * Generates realistic real-time operational data and historical orders across all 9 outlets
 */
export async function seedRealisticCampusOrders(): Promise<number> {
    try {
        const shops = await prisma.shop.findMany({
            include: { items: { where: { isAvailable: true } } }
        });
        const customers = await prisma.user.findMany({
            where: {
                roles: { some: { role: { name: 'CUSTOMER' } } }
            }
        });

        if (shops.length === 0 || customers.length === 0) return 0;

        const paymentMethods = ['UPI', 'ONLINE_DEMO', 'RAZORPAY_DEMO', 'CASH', 'NET_BANKING_DEMO'];
        const now = new Date();
        let createdCount = 0;

        // Ensure a couple of items have dynamic surplus discount active
        const discountCandidates = await prisma.foodItem.findMany({ take: 4 });
        for (const item of discountCandidates) {
            const originalPrice = item.originalPrice || item.price;
            const discountPercent = 25;
            const discountedPrice = Math.max(5, Math.round(originalPrice * 0.75));
            await prisma.foodItem.update({
                where: { id: item.id },
                data: {
                    originalPrice,
                    price: discountedPrice,
                    discountPercent,
                    isDynamicPricing: true
                }
            });
        }

        // Mark 1 stall as closing soon to showcase closing clearance reports
        if (shops.length > 2) {
            await prisma.shop.update({
                where: { id: shops[2].id },
                data: { isClosingSoon: true, closingDiscount: 25 }
            });
        }

        // 1. Generate Past 6 Days Orders (Completed / Cancelled)
        for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
            const targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
            const ordersForDay = 8 + Math.floor(Math.random() * 6); // 8-13 orders per past day

            const mealPeakHours = [
                { hour: 9, minute: 15 },
                { hour: 9, minute: 45 },
                { hour: 12, minute: 20 },
                { hour: 12, minute: 50 },
                { hour: 13, minute: 15 },
                { hour: 13, minute: 40 },
                { hour: 17, minute: 10 },
                { hour: 17, minute: 45 },
                { hour: 19, minute: 30 },
                { hour: 20, minute: 15 },
                { hour: 20, minute: 50 },
                { hour: 21, minute: 20 }
            ];

            for (let i = 0; i < ordersForDay; i++) {
                const shop = shops[Math.floor(Math.random() * shops.length)];
                if (!shop.items || shop.items.length === 0) continue;

                const customer = customers[Math.floor(Math.random() * customers.length)];
                const peak = mealPeakHours[i % mealPeakHours.length];
                const orderDate = new Date(targetDate);
                orderDate.setHours(peak.hour, peak.minute + Math.floor(Math.random() * 15), Math.floor(Math.random() * 59));

                const isCancelled = Math.random() < 0.06;
                const status = isCancelled ? 'CANCELLED' : 'COMPLETED';
                const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

                // Select 1-3 items
                const numItems = Math.min(shop.items.length, 1 + Math.floor(Math.random() * 2));
                const shuffled = [...shop.items].sort(() => 0.5 - Math.random());
                const selectedItems = shuffled.slice(0, numItems);

                let totalAmount = 0;
                const orderItemsData = selectedItems.map(item => {
                    const quantity = 1 + (Math.random() < 0.3 ? 1 : 0);
                    totalAmount += item.price * quantity;
                    return {
                        itemId: item.id,
                        quantity,
                        priceAtOrder: item.price
                    };
                });

                const isPreorder = Math.random() < 0.25;

                await prisma.order.create({
                    data: {
                        customerId: customer.id,
                        shopId: shop.id,
                        status,
                        totalAmount,
                        orderTime: orderDate,
                        isPreorder,
                        pickupTime: isPreorder ? '13:30' : null,
                        estimatedMinutes: 8 + Math.floor(Math.random() * 10),
                        queueNumber: 1 + Math.floor(Math.random() * 15),
                        paymentMethod,
                        items: { create: orderItemsData },
                        payments: {
                            create: {
                                amount: totalAmount,
                                status: isCancelled ? 'FAILED' : 'SUCCESS',
                                attemptTime: orderDate
                            }
                        }
                    }
                });
                createdCount++;
            }
        }

        // 2. Generate Today's Orders (Live Real-time kitchen queue + completed today)
        const todayCompletedCount = 8;
        for (let i = 0; i < todayCompletedCount; i++) {
            const shop = shops[Math.floor(Math.random() * shops.length)];
            if (!shop.items || shop.items.length === 0) continue;
            const customer = customers[Math.floor(Math.random() * customers.length)];

            const orderDate = new Date();
            orderDate.setHours(8 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 59));

            const shuffled = [...shop.items].sort(() => 0.5 - Math.random());
            const selectedItems = shuffled.slice(0, 1 + Math.floor(Math.random() * 2));

            let totalAmount = 0;
            const orderItemsData = selectedItems.map(item => {
                const quantity = 1 + (Math.random() < 0.25 ? 1 : 0);
                totalAmount += item.price * quantity;
                return { itemId: item.id, quantity, priceAtOrder: item.price };
            });

            await prisma.order.create({
                data: {
                    customerId: customer.id,
                    shopId: shop.id,
                    status: 'COMPLETED',
                    totalAmount,
                    orderTime: orderDate,
                    isPreorder: false,
                    estimatedMinutes: 10,
                    queueNumber: i + 1,
                    paymentMethod: 'UPI',
                    items: { create: orderItemsData },
                    payments: { create: { amount: totalAmount, status: 'SUCCESS', attemptTime: orderDate } }
                }
            });
            createdCount++;
        }

        // 3. Live Active Kitchen Queue (PLACED, PREPARING, READY)
        const liveQueuePlan = [
            { status: 'PLACED', queueOffset: 1, minsAgo: 4, prepMin: 12 },
            { status: 'PLACED', queueOffset: 2, minsAgo: 7, prepMin: 14 },
            { status: 'PREPARING', queueOffset: 3, minsAgo: 10, prepMin: 8 },
            { status: 'PREPARING', queueOffset: 4, minsAgo: 14, prepMin: 6 },
            { status: 'PREPARING', queueOffset: 5, minsAgo: 16, prepMin: 5 },
            { status: 'READY', queueOffset: 6, minsAgo: 20, prepMin: 2 },
            { status: 'READY', queueOffset: 7, minsAgo: 24, prepMin: 1 }
        ];

        for (const queueItem of liveQueuePlan) {
            const shop = shops[Math.floor(Math.random() * shops.length)];
            if (!shop.items || shop.items.length === 0) continue;
            const customer = customers[Math.floor(Math.random() * customers.length)];

            const orderDate = new Date(now.getTime() - queueItem.minsAgo * 60 * 1000);
            const shuffled = [...shop.items].sort(() => 0.5 - Math.random());
            const selectedItems = shuffled.slice(0, 1 + Math.floor(Math.random() * 2));

            let totalAmount = 0;
            const orderItemsData = selectedItems.map(item => {
                const quantity = 1;
                totalAmount += item.price * quantity;
                return { itemId: item.id, quantity, priceAtOrder: item.price };
            });

            await prisma.order.create({
                data: {
                    customerId: customer.id,
                    shopId: shop.id,
                    status: queueItem.status,
                    totalAmount,
                    orderTime: orderDate,
                    isPreorder: Math.random() < 0.3,
                    pickupTime: Math.random() < 0.3 ? '19:45' : null,
                    estimatedMinutes: queueItem.prepMin,
                    queueNumber: queueItem.queueOffset,
                    paymentMethod: Math.random() < 0.7 ? 'UPI' : 'ONLINE_DEMO',
                    items: { create: orderItemsData },
                    payments: { create: { amount: totalAmount, status: 'SUCCESS', attemptTime: orderDate } }
                }
            });
            createdCount++;
        }

        console.log(`✅ Seeded ${createdCount} realistic real-time and historical orders for platform calculations`);
        return createdCount;
    } catch (err) {
        console.error('Error seeding realistic campus orders:', err);
        return 0;
    }
}
