process.env.NODE_ENV = 'test';
process.env.DISABLE_RATE_LIMIT = 'true';

import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/db/prisma';
import { env } from '../src/config/env';

async function runAcceptanceTests() {
    console.log('================================================================');
    console.log('🧪 CAMPUS BITES - COMPREHENSIVE END-TO-END ACCEPTANCE TEST SUITE');
    console.log('================================================================');

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    async function step(title: string, fn: () => Promise<void>) {
        totalTests++;
        try {
            await fn();
            console.log(`  ✅ PASS: ${title}`);
            passedTests++;
        } catch (err: any) {
            console.error(`  ❌ FAIL: ${title}`);
            console.error(`     Error: ${err.message || err}`);
            failedTests++;
        }
    }

    const testPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Track test entity IDs for clean teardown
    const createdOrders: number[] = [];
    const createdSchedules: number[] = [];
    const createdItemIds: number[] = [];

    try {
        // ============================================================================
        // 0. FIXTURE SETUP
        // ============================================================================
        console.log('\n[Setup] Establishing isolated test fixtures for all 4 platform roles...');

        // Verify or create Area
        let area = await prisma.area.findFirst();
        if (!area) {
            area = await prisma.area.create({ data: { name: 'Main Campus Food Court' } });
        }

        // Roles
        const customerRole = await prisma.role.upsert({ where: { name: 'CUSTOMER' }, update: {}, create: { name: 'CUSTOMER' } });
        const staffRole = await prisma.role.upsert({ where: { name: 'STAFF' }, update: {}, create: { name: 'STAFF' } });
        const ownerRole = await prisma.role.upsert({ where: { name: 'OWNER' }, update: {}, create: { name: 'OWNER' } });
        const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });

        // 1. Customer User
        let customerUser = await prisma.user.findFirst({ where: { email: 'uat.customer@campusbites.test' } });
        if (!customerUser) {
            customerUser = await prisma.user.create({
                data: {
                    fullName: 'UAT Customer Student',
                    email: 'uat.customer@campusbites.test',
                    passwordHash,
                    phone: '9876543210',
                    roles: { create: { roleId: customerRole.id } }
                }
            });
        }

        // 2. Owner User & Stall
        let ownerUser = await prisma.user.findFirst({ where: { email: 'uat.owner@campusbites.test' } });
        if (!ownerUser) {
            ownerUser = await prisma.user.create({
                data: {
                    fullName: 'UAT Stall Owner',
                    email: 'uat.owner@campusbites.test',
                    passwordHash,
                    phone: '9876543211',
                    roles: { create: { roleId: ownerRole.id } }
                }
            });
        }

        let testShop = await prisma.shop.findFirst({ where: { ownerId: ownerUser.id } });
        if (!testShop) {
            testShop = await prisma.shop.create({
                data: {
                    name: 'UAT Acceptance Stall',
                    ownerId: ownerUser.id,
                    areaId: area.id,
                    status: 'ACTIVE'
                }
            });
        }

        // Stall category & food items
        let category = await prisma.category.findFirst({ where: { name: 'Beverages' } });
        if (!category) {
            category = await prisma.category.create({ data: { name: 'Beverages' } });
        }

        let foodItemA = await prisma.foodItem.findFirst({ where: { shopId: testShop.id, name: 'UAT Masala Chai' } });
        if (!foodItemA) {
            foodItemA = await prisma.foodItem.create({
                data: {
                    shopId: testShop.id,
                    categoryId: category.id,
                    name: 'UAT Masala Chai',
                    price: 25,
                    isAvailable: true
                }
            });
        }

        let foodItemB = await prisma.foodItem.findFirst({ where: { shopId: testShop.id, name: 'UAT Samosa Plate' } });
        if (!foodItemB) {
            foodItemB = await prisma.foodItem.create({
                data: {
                    shopId: testShop.id,
                    categoryId: category.id,
                    name: 'UAT Samosa Plate',
                    price: 40,
                    isAvailable: true
                }
            });
        }

        // 3. Staff User assigned to testShop
        let staffUser = await prisma.user.findFirst({ where: { email: 'uat.staff@campusbites.test' } });
        if (!staffUser) {
            staffUser = await prisma.user.create({
                data: {
                    fullName: 'UAT Kitchen Staff',
                    email: 'uat.staff@campusbites.test',
                    passwordHash,
                    phone: '9876543212',
                    roles: { create: { roleId: staffRole.id } }
                }
            });
        }
        await prisma.shopStaff.upsert({
            where: { shopId_staffId: { shopId: testShop.id, staffId: staffUser.id } },
            update: {},
            create: { shopId: testShop.id, staffId: staffUser.id }
        });

        // 4. Admin User
        let adminUser = await prisma.user.findFirst({ where: { email: 'uat.admin@campusbites.test' } });
        if (!adminUser) {
            adminUser = await prisma.user.create({
                data: {
                    fullName: 'UAT Platform Admin',
                    email: 'uat.admin@campusbites.test',
                    passwordHash,
                    phone: '9876543213',
                    roles: { create: { roleId: adminRole.id } }
                }
            });
        }

        console.log('[Setup] Test fixtures initialized successfully.');

        let customerToken = '';
        let staffToken = '';
        let ownerToken = '';
        let adminToken = '';

        // ============================================================================
        // SUITE 1: CUSTOMER END-TO-END JOURNEY
        // ============================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('📌 SUITE 1: CUSTOMER JOURNEY (Auth -> Browse -> Cart -> Order -> Track -> Cancel / Review)');
        console.log('----------------------------------------------------------------');

        let placedOrderId = 0;
        let reviewOrderId = 0;

        await step('Customer authentication via /api/auth/login returns valid JWT token', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: customerUser!.email, password: testPassword });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            if (!res.body.token) throw new Error('Token missing from login response');
            if (res.body.user.role !== 'CUSTOMER') throw new Error(`Expected CUSTOMER role, got ${res.body.user.role}`);
            customerToken = res.body.token;
        });

        await step('Customer browses available outlets via /api/shops', async () => {
            const res = await request(app).get('/api/shops');
            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (!Array.isArray(res.body)) throw new Error('Expected array of shops');
            const found = res.body.find((s: any) => s.id === testShop!.id || s.shop_id === testShop!.id);
            if (!found) throw new Error('Test stall not found in shops listing');
        });

        await step('Customer inspects stall details via /api/shops/:shopId', async () => {
            const res = await request(app).get(`/api/shops/${testShop!.id}`);
            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (res.body.name !== testShop!.name) throw new Error('Stall name mismatch');
        });

        await step('Customer inspects stall menu items via /api/shops/:shopId/items', async () => {
            const res = await request(app).get(`/api/shops/${testShop!.id}/items`);
            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (!Array.isArray(res.body) || res.body.length === 0) throw new Error('Stall items missing');
        });

        await step('Customer places order via /api/orders with item selection and paymentMethod', async () => {
            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: testShop!.id,
                    items: [
                        { itemId: foodItemA!.id, quantity: 2 },
                        { itemId: foodItemB!.id, quantity: 1 }
                    ],
                    paymentMethod: 'ONLINE_DEMO',
                    pickupTime: '13:00'
                });

            if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
            const orderId = res.body.order?.id || res.body.id || res.body.orderId;
            if (!orderId) throw new Error('Order creation missing order ID');
            const total = res.body.order?.totalAmount ?? res.body.totalAmount ?? res.body.total_amount;
            if (total !== 90) throw new Error(`Expected total 90, got ${total}`);
            placedOrderId = orderId;
            createdOrders.push(placedOrderId);
        });

        await step('Customer tracks active order status via /api/orders/:orderId', async () => {
            const res = await request(app)
                .get(`/api/orders/${placedOrderId}`)
                .set('Authorization', `Bearer ${customerToken}`);

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (res.body.id !== placedOrderId) throw new Error('Returned order ID mismatch');
            if (res.body.status !== 'PAYMENT_PENDING' && res.body.status !== 'PLACED') {
                throw new Error(`Unexpected status ${res.body.status}`);
            }
        });

        await step('Customer cancels active unfulfilled order via /api/orders/:orderId/cancel', async () => {
            const res = await request(app)
                .patch(`/api/orders/${placedOrderId}/cancel`)
                .set('Authorization', `Bearer ${customerToken}`);

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            const status = res.body.order?.status || res.body.status;
            if (status !== 'CANCELLED') throw new Error(`Expected status CANCELLED, got ${status}`);
        });

        await step('Customer places a second order and prepares it for review', async () => {
            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: testShop!.id,
                    items: [{ itemId: foodItemA!.id, quantity: 1 }],
                    paymentMethod: 'ONLINE_DEMO'
                });

            if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
            reviewOrderId = res.body.order?.id || res.body.id || res.body.orderId;
            if (!reviewOrderId) throw new Error('Review order creation missing ID');
            createdOrders.push(reviewOrderId);

            // Mark order as COMPLETED directly in DB to allow review submission
            await prisma.order.update({
                where: { id: reviewOrderId },
                data: { status: 'COMPLETED' }
            });
        });

        await step('Customer submits review on COMPLETED order via /api/reviews', async () => {
            const res = await request(app)
                .post('/api/reviews')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    orderId: reviewOrderId,
                    shopId: testShop!.id,
                    rating: 5,
                    comment: 'Exemplary service and delicious chai!'
                });

            if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
            if (!res.body.review || res.body.review.rating !== 5) throw new Error('Review record missing rating');
        });

        // ============================================================================
        // SUITE 2: STAFF & KITCHEN JOURNEY
        // ============================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('📌 SUITE 2: STAFF JOURNEY (Login -> Kitchen Orders -> PREPARING -> READY -> COMPLETED)');
        console.log('----------------------------------------------------------------');

        let kitchenOrderId = 0;

        await step('Staff logs in via /api/auth/login and receives STAFF credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: staffUser!.email, password: testPassword });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            if (res.body.user.role !== 'STAFF') throw new Error(`Expected STAFF role, got ${res.body.user.role}`);
            staffToken = res.body.token;
        });

        await step('Customer places order and confirms payment for kitchen processing', async () => {
            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: testShop!.id,
                    items: [{ itemId: foodItemB!.id, quantity: 2 }],
                    paymentMethod: 'ONLINE_DEMO'
                });

            if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
            kitchenOrderId = res.body.order?.id || res.body.id || res.body.orderId;
            if (!kitchenOrderId) throw new Error('Kitchen order creation missing ID');
            createdOrders.push(kitchenOrderId);

            // Confirm payment so order advances from PAYMENT_PENDING -> PLACED
            const payRes = await request(app)
                .post(`/api/orders/${kitchenOrderId}/payment`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ status: 'SUCCESS' });

            if (payRes.status !== 200) throw new Error(`Payment confirmation failed: ${payRes.status}`);
        });

        await step('Staff queries kitchen queue via /api/staff/orders', async () => {
            const res = await request(app)
                .get('/api/staff/orders')
                .set('Authorization', `Bearer ${staffToken}`);

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (!Array.isArray(res.body)) throw new Error('Expected array of staff orders');
            const found = res.body.find((o: any) => o.id === kitchenOrderId);
            if (!found) throw new Error(`Order #${kitchenOrderId} not visible in staff orders`);
        });

        await step('Staff updates order state from PLACED -> PREPARING', async () => {
            const res = await request(app)
                .patch(`/api/staff/orders/${kitchenOrderId}/status`)
                .set('Authorization', `Bearer ${staffToken}`)
                .send({ status: 'PREPARING' });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            const status = res.body.order?.status || res.body.status;
            if (status !== 'PREPARING') throw new Error(`Expected PREPARING, got ${status}`);
        });

        await step('Staff updates order state from PREPARING -> READY', async () => {
            const res = await request(app)
                .patch(`/api/staff/orders/${kitchenOrderId}/status`)
                .set('Authorization', `Bearer ${staffToken}`)
                .send({ status: 'READY' });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            const status = res.body.order?.status || res.body.status;
            if (status !== 'READY') throw new Error(`Expected READY, got ${status}`);
        });

        await step('Staff marks order as COMPLETED', async () => {
            const res = await request(app)
                .patch(`/api/staff/orders/${kitchenOrderId}/status`)
                .set('Authorization', `Bearer ${staffToken}`)
                .send({ status: 'COMPLETED' });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            const status = res.body.order?.status || res.body.status;
            if (status !== 'COMPLETED') throw new Error(`Expected COMPLETED, got ${status}`);
        });

        // ============================================================================
        // SUITE 3: OWNER JOURNEY
        // ============================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('📌 SUITE 3: OWNER JOURNEY (Login -> Outlet Management -> Toggle Status -> Menu Control)');
        console.log('----------------------------------------------------------------');

        let createdItemId = 0;

        await step('Owner logs in via /api/auth/login and receives OWNER role', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: ownerUser!.email, password: testPassword });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            if (res.body.user.role !== 'OWNER') throw new Error(`Expected OWNER role, got ${res.body.user.role}`);
            ownerToken = res.body.token;
        });

        await step('Owner views stall profile via /api/owner/shop', async () => {
            const res = await request(app)
                .get('/api/owner/shop')
                .set('Authorization', `Bearer ${ownerToken}`);

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            if (res.body.id !== testShop!.id) throw new Error('Stall ID mismatch');
        });

        await step('Owner toggles stall operational status to BUSY via /api/owner/shop/status', async () => {
            const res = await request(app)
                .patch('/api/owner/shop/status')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ status: 'BUSY' });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            if (res.body.shop.status !== 'BUSY') throw new Error(`Expected BUSY status, got ${res.body.shop.status}`);
        });

        await step('Owner reverts stall operational status to ACTIVE', async () => {
            const res = await request(app)
                .patch('/api/owner/shop/status')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ status: 'ACTIVE' });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (res.body.shop.status !== 'ACTIVE') throw new Error(`Expected ACTIVE status, got ${res.body.shop.status}`);
        });

        await step('Owner adds new seasonal item via /api/owner/items', async () => {
            const res = await request(app)
                .post('/api/owner/items')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({
                    shopId: testShop!.id,
                    categoryId: category!.id,
                    name: 'UAT Mango Lassi',
                    description: 'Fresh chilled sweet mango yogurt drink',
                    price: 55,
                    isAvailable: true
                });

            if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
            createdItemId = res.body.itemId;
            createdItemIds.push(createdItemId);
        });

        await step('Owner updates price on new item via /api/owner/items/:itemId', async () => {
            const res = await request(app)
                .patch(`/api/owner/items/${createdItemId}`)
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({ price: 60 });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (res.body.item.price !== 60) throw new Error(`Expected price 60, got ${res.body.item.price}`);
        });

        await step('Owner removes item via /api/owner/items/:itemId', async () => {
            const res = await request(app)
                .delete(`/api/owner/items/${createdItemId}`)
                .set('Authorization', `Bearer ${ownerToken}`);

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        });

        // ============================================================================
        // SUITE 4: ADMIN JOURNEY
        // ============================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('📌 SUITE 4: ADMIN JOURNEY (Login -> Dashboard Stats -> Manage Stalls -> Audit Log)');
        console.log('----------------------------------------------------------------');

        await step('Admin logs in via /api/auth/login and receives ADMIN token', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: adminUser!.email, password: testPassword });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (res.body.user.role !== 'ADMIN') throw new Error(`Expected ADMIN role, got ${res.body.user.role}`);
            adminToken = res.body.token;
        });

        await step('Admin accesses overview metrics via /api/admin/stats', async () => {
            const res = await request(app)
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${adminToken}`);

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (!res.body.summary) throw new Error('Summary metrics missing from admin dashboard');
            if (typeof res.body.summary.totalRevenue !== 'number') throw new Error('totalRevenue missing');
            if (typeof res.body.summary.totalOrders !== 'number') throw new Error('totalOrders missing');
        });

        await step('Admin modifies stall configuration via /api/admin/stalls/:shopId', async () => {
            const res = await request(app)
                .patch(`/api/admin/stalls/${testShop!.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isClosingSoon: true, closingDiscount: 15 });

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            if (res.body.stall.closingDiscount !== 15) throw new Error('Closing discount was not updated');

            // Revert closing soon setting
            await request(app)
                .patch(`/api/admin/stalls/${testShop!.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isClosingSoon: false, closingDiscount: 0 });
        });

        await step('Admin inspects system Audit Log via /api/admin/audit-logs', async () => {
            const res = await request(app)
                .get('/api/admin/audit-logs')
                .set('Authorization', `Bearer ${adminToken}`);

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            const logsArray = Array.isArray(res.body) ? res.body : res.body.logs;
            if (!Array.isArray(logsArray)) throw new Error('Expected array of audit log entries');
            const recentUpdate = logsArray.find((l: any) => l.action === 'UPDATE_STALL' && l.entityId === testShop!.id);
            if (!recentUpdate) throw new Error('Stall update action not recorded in AuditLog');
        });

        // ============================================================================
        // SUITE 5: AUTOBOOK JOURNEY
        // ============================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('📌 SUITE 5: AUTOBOOK JOURNEY (Create Schedule -> Query -> Toggle -> Trigger Execution)');
        console.log('----------------------------------------------------------------');

        let autobookScheduleId = 0;

        await step('Customer creates daily recurring schedule via /api/orders/autobook/schedules', async () => {
            const res = await request(app)
                .post('/api/orders/autobook/schedules')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: testShop!.id,
                    itemId: foodItemA!.id,
                    quantity: 2,
                    scheduledTime: '08:30',
                    isActive: true
                });

            if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
            if (!res.body.schedule || !res.body.schedule.id) throw new Error('Schedule ID missing');
            autobookScheduleId = res.body.schedule.id;
            createdSchedules.push(autobookScheduleId);
        });

        await step('Customer queries autobook schedules via /api/orders/autobook/schedules', async () => {
            const res = await request(app)
                .get('/api/orders/autobook/schedules')
                .set('Authorization', `Bearer ${customerToken}`);

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            const found = res.body.find((s: any) => s.id === autobookScheduleId);
            if (!found) throw new Error('Created autobook schedule not returned in user listing');
        });

        await step('Customer toggles autobook schedule status via /api/orders/autobook/schedules/:id/toggle', async () => {
            const res = await request(app)
                .patch(`/api/orders/autobook/schedules/${autobookScheduleId}/toggle`)
                .set('Authorization', `Bearer ${customerToken}`);

            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (res.body.schedule.isActive !== false) throw new Error('Schedule isActive did not toggle to false');

            // Re-enable schedule for execution test
            await request(app)
                .patch(`/api/orders/autobook/schedules/${autobookScheduleId}/toggle`)
                .set('Authorization', `Bearer ${customerToken}`);
        });

        await step('Customer triggers immediate execution of schedule via /api/orders/autobook/schedules/:id/execute', async () => {
            const res = await request(app)
                .post(`/api/orders/autobook/schedules/${autobookScheduleId}/execute`)
                .set('Authorization', `Bearer ${customerToken}`);

            if (res.status !== 200 && res.status !== 201) {
                throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
            }
            const orderId = res.body.order?.id || res.body.result?.orderId;
            if (!orderId) throw new Error('Executed order ID missing from response');

            createdOrders.push(orderId);
        });

        // ============================================================================
        // SUITE 6: EDGE CASES & SECURITY BOUNDARY HARDENING
        // ============================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('📌 SUITE 6: EDGE CASES & SECURITY BOUNDARY HARDENING');
        console.log('----------------------------------------------------------------');

        await step('Rejects order with invalid zero quantity (HTTP 400)', async () => {
            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: testShop!.id,
                    items: [{ itemId: foodItemA!.id, quantity: 0 }],
                    paymentMethod: 'ONLINE_DEMO'
                });

            if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
        });

        await step('Rejects order with excessive quantity > 50 (HTTP 400)', async () => {
            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: testShop!.id,
                    items: [{ itemId: foodItemA!.id, quantity: 999 }],
                    paymentMethod: 'ONLINE_DEMO'
                });

            if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
        });

        await step('Rejects unauthenticated request without token (HTTP 401)', async () => {
            const res = await request(app).get('/api/orders');
            if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
        });

        await step('Rejects request with expired or invalid token (HTTP 403)', async () => {
            const expiredToken = jwt.sign(
                { userId: customerUser!.id, role: 'CUSTOMER' },
                env.JWT_SECRET,
                { expiresIn: -10 }
            );

            const res = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${expiredToken}`);

            if (res.status !== 403 && res.status !== 401) throw new Error(`Expected 401 or 403, got ${res.status}`);
        });

        await step('Rejects customer attempting unauthorized access to admin dashboard (HTTP 403)', async () => {
            const res = await request(app)
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${customerToken}`);

            if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
        });

        await step('Rejects customer attempting unauthorized access to kitchen queue (HTTP 403)', async () => {
            const res = await request(app)
                .get('/api/staff/orders')
                .set('Authorization', `Bearer ${customerToken}`);

            if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
        });

        await step('Rejects illegal order state transition PLACED -> COMPLETED directly (HTTP 400)', async () => {
            // Create fresh order and confirm payment so it is PLACED
            const orderRes = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: testShop!.id,
                    items: [{ itemId: foodItemA!.id, quantity: 1 }],
                    paymentMethod: 'ONLINE_DEMO'
                });

            const testOrderId = orderRes.body.order?.id || orderRes.body.id || orderRes.body.orderId;
            createdOrders.push(testOrderId);

            await request(app)
                .post(`/api/orders/${testOrderId}/payment`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ status: 'SUCCESS' });

            const res = await request(app)
                .patch(`/api/staff/orders/${testOrderId}/status`)
                .set('Authorization', `Bearer ${staffToken}`)
                .send({ status: 'COMPLETED' });

            if (res.status !== 400) throw new Error(`Expected 400 Bad Request, got ${res.status}`);
        });

        // ============================================================================
        // SUITE 7: HEALTH & LIVENESS PROBES
        // ============================================================================
        console.log('\n----------------------------------------------------------------');
        console.log('📌 SUITE 7: PRODUCTION HEALTH & READINESS PROBES');
        console.log('----------------------------------------------------------------');

        await step('Liveness probe GET /health returns status ok with timestamp', async () => {
            const res = await request(app).get('/health');
            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (res.body.status !== 'ok') throw new Error(`Expected ok, got ${res.body.status}`);
            if (!res.body.timestamp) throw new Error('Missing timestamp in health probe');
        });

        await step('Liveness probe GET /health/live returns status ok', async () => {
            const res = await request(app).get('/health/live');
            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (res.body.status !== 'ok') throw new Error(`Expected ok, got ${res.body.status}`);
        });

        await step('Readiness probe GET /health/ready verifies database connectivity', async () => {
            const res = await request(app).get('/health/ready');
            if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
            if (res.body.status !== 'ok') throw new Error(`Expected ok, got ${res.body.status}`);
            if (res.body.database !== 'connected') throw new Error(`Expected database: connected, got ${res.body.database}`);
        });

    } finally {
        // ============================================================================
        // CLEANUP
        // ============================================================================
        console.log('\n[Teardown] Cleaning up acceptance test records...');
        try {
            if (createdOrders.length > 0) {
                await prisma.review.deleteMany({ where: { orderId: { in: createdOrders } } });
                await prisma.autobookExecutionLog.deleteMany({ where: { orderId: { in: createdOrders } } });
                await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrders } } });
                await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: createdOrders } } });
                await prisma.order.deleteMany({ where: { id: { in: createdOrders } } });
            }
            if (createdSchedules.length > 0) {
                await prisma.autobookExecutionLog.deleteMany({ where: { scheduleId: { in: createdSchedules } } });
                await prisma.autobookSchedule.deleteMany({ where: { id: { in: createdSchedules } } });
            }
            if (createdItemIds.length > 0) {
                await prisma.foodItem.deleteMany({ where: { id: { in: createdItemIds } } });
            }
            console.log('[Teardown] Database state restored cleanly.');
        } catch (cleanErr) {
            console.error('[Teardown] Warning during cleanup:', cleanErr);
        } finally {
            await prisma.$disconnect();
        }
    }

    console.log('\n================================================================');
    console.log(`🏁 ACCEPTANCE TEST RESULTS: ${passedTests} PASSED | ${failedTests} FAILED (TOTAL: ${totalTests})`);
    console.log('================================================================');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runAcceptanceTests().catch(err => {
    console.error('Fatal acceptance test failure:', err);
    process.exit(1);
});
