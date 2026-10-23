process.env.NODE_ENV = 'test';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/db/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';
import { 
    claimAndExecuteSchedule, 
    executeDueAutobookSchedules 
} from '../src/services/autobookScheduler';
import { 
    generateWebhookSignature, 
    verifyWebhookSignature 
} from '../src/services/paymentService';

const JWT_SECRET = env.JWT_SECRET;

function generateToken(payload: { userId: number; role: string; shopId?: number }): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runTestSuite() {
    console.log('====================================================');
    console.log('🧪 RUNNING COMPREHENSIVE ORDER & AUTOBOOK ARCHITECTURE TESTS');
    console.log('====================================================');

    let passed = 0;
    let failed = 0;

    async function assertTest(name: string, fn: () => Promise<void>) {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err: any) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Error: ${err.message}`);
            failed++;
        }
    }

    // ==========================================
    // TEST ENVIRONMENT SETUP
    // ==========================================
    // Database connection warm-up with retry
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await prisma.$connect();
            break;
        } catch (connErr) {
            if (attempt === 3) throw connErr;
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Locate or create test customer and staff
    let customer = await prisma.user.findFirst({
        where: { email: 'test_order_customer@campusbites.internal' }
    });
    if (!customer) {
        customer = await prisma.user.create({
            data: {
                fullName: 'Test Order Customer',
                email: 'test_order_customer@campusbites.internal',
                passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
                isActive: true
            }
        });
    }

    // Locate active shop and its staff
    const shop = await prisma.shop.findFirst({
        where: { status: 'ACTIVE' },
        include: { items: true, staff: { include: { staff: true } } }
    });
    if (!shop || shop.items.length === 0) {
        throw new Error('A valid shop with food items is required to execute tests');
    }

    const availableItem = shop.items.find(i => i.isAvailable) || shop.items[0];

    // Ensure staff member exists for this shop
    let staffUser = shop.staff[0]?.staff;
    if (!staffUser) {
        staffUser = await prisma.user.create({
            data: {
                fullName: 'Test Shop Staff',
                email: `test_staff_shop${shop.id}@campusbites.internal`,
                passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
                isActive: true
            }
        });
        await prisma.shopStaff.create({
            data: { shopId: shop.id, staffId: staffUser.id }
        });
    }

    const customerToken = generateToken({ userId: customer.id, role: 'CUSTOMER' });
    const staffToken = generateToken({ userId: staffUser.id, role: 'STAFF', shopId: shop.id });

    // Track order IDs created to cleanly clean up later
    const createdOrderIds: number[] = [];
    const createdScheduleIds: number[] = [];

    // ==========================================
    // 1. TRANSACTION ROLLBACK ON FAILURE
    // ==========================================
    await assertTest('Transaction rollback on failure: invalid item rolls back all order records', async () => {
        const orderCountBefore = await prisma.order.count({ where: { customerId: customer!.id } });
        const orderItemCountBefore = await prisma.orderItem.count();

        // Customer attempts to order 1 valid item and 1 invalid item (#999999)
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                shopId: shop.id,
                items: [
                    { itemId: availableItem.id, quantity: 1 },
                    { itemId: 999999, quantity: 1 } // Non-existent item
                ]
            });

        if (res.status !== 400) {
            throw new Error(`Expected HTTP 400 on invalid item submission, got ${res.status}: ${JSON.stringify(res.body)}`);
        }

        const orderCountAfter = await prisma.order.count({ where: { customerId: customer!.id } });
        const orderItemCountAfter = await prisma.orderItem.count();

        if (orderCountAfter !== orderCountBefore) {
            throw new Error(`Transaction rollback failure: Order was partially inserted! Before: ${orderCountBefore}, After: ${orderCountAfter}`);
        }
        if (orderItemCountAfter !== orderItemCountBefore) {
            throw new Error(`Transaction rollback failure: OrderItem was partially inserted! Before: ${orderItemCountBefore}, After: ${orderItemCountAfter}`);
        }
    });

    // ==========================================
    // 2. IDEMPOTENCY KEY PREVENTS DUPLICATE ORDERS
    // ==========================================
    await assertTest('Idempotency key prevents duplicate order creation on identical replays', async () => {
        const testIdempotencyKey = `idemp-test-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

        // Request 1: First submission
        const res1 = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .set('Idempotency-Key', testIdempotencyKey)
            .send({
                shopId: shop.id,
                items: [{ itemId: availableItem.id, quantity: 2 }]
            });

        if (res1.status !== 201) {
            throw new Error(`Expected 201 on first order submission, got ${res1.status}: ${JSON.stringify(res1.body)}`);
        }

        const firstOrderId = res1.body.orderId || res1.body.id;
        if (!firstOrderId) {
            throw new Error('Order creation did not return orderId');
        }
        createdOrderIds.push(firstOrderId);

        // Request 2: Replay identical request with the same Idempotency-Key header
        const res2 = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .set('Idempotency-Key', testIdempotencyKey)
            .send({
                shopId: shop.id,
                items: [{ itemId: availableItem.id, quantity: 2 }]
            });

        if (res2.status !== 200 && res2.status !== 201) {
            throw new Error(`Expected 200/201 on idempotent replay, got ${res2.status}: ${JSON.stringify(res2.body)}`);
        }

        const secondOrderId = res2.body.orderId || res2.body.id;
        if (secondOrderId !== firstOrderId) {
            throw new Error(`Idempotency violated: duplicate order created! First: ${firstOrderId}, Second: ${secondOrderId}`);
        }

        // Verify database holds exactly 1 record with this idempotency key
        const countInDb = await prisma.order.count({
            where: { idempotencyKey: testIdempotencyKey }
        });

        if (countInDb !== 1) {
            throw new Error(`Expected exactly 1 order in database with idempotencyKey, found ${countInDb}`);
        }
    });

    // ==========================================
    // 3. STRICT STATUS STATE MACHINE ENFORCEMENT
    // ==========================================
    await assertTest('Strict state machine: linear lifecycle PAYMENT_PENDING -> PLACED -> PREPARING -> READY -> COMPLETED', async () => {
        // Create order initially in PAYMENT_PENDING
        const resCreate = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                shopId: shop.id,
                items: [{ itemId: availableItem.id, quantity: 1 }]
            });

        const orderId = resCreate.body.orderId || resCreate.body.id;
        createdOrderIds.push(orderId);

        let orderRecord = await prisma.order.findUnique({ where: { id: orderId } });
        if (orderRecord?.status !== 'PAYMENT_PENDING') {
            throw new Error(`Expected initial status to be PAYMENT_PENDING, got ${orderRecord?.status}`);
        }

        // Step 1: Confirm Payment -> PLACED
        const resPay = await request(app)
            .post(`/api/orders/${orderId}/payment`)
            .set('Authorization', `Bearer ${customerToken}`);

        if (resPay.status !== 200) {
            throw new Error(`Expected 200 on payment confirmation, got ${resPay.status}: ${JSON.stringify(resPay.body)}`);
        }

        orderRecord = await prisma.order.findUnique({ where: { id: orderId } });
        if (orderRecord?.status !== 'PLACED') {
            throw new Error(`Expected status to transition to PLACED after payment, got ${orderRecord?.status}`);
        }

        // Step 2: Idempotent payment confirmation safe replay
        const resPayReplay = await request(app)
            .post(`/api/orders/${orderId}/payment`)
            .set('Authorization', `Bearer ${customerToken}`);

        if (resPayReplay.status !== 200) {
            throw new Error(`Expected 200 on idempotent payment replay, got ${resPayReplay.status}`);
        }

        // Step 3: Staff moves PLACED -> PREPARING
        const resPrep = await request(app)
            .patch(`/api/staff/orders/${orderId}/status`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ status: 'PREPARING' });

        if (resPrep.status !== 200) {
            throw new Error(`Expected 200 on transition to PREPARING, got ${resPrep.status}: ${JSON.stringify(resPrep.body)}`);
        }

        // Step 4: Staff moves PREPARING -> READY
        const resReady = await request(app)
            .patch(`/api/staff/orders/${orderId}/status`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ status: 'READY' });

        if (resReady.status !== 200) {
            throw new Error(`Expected 200 on transition to READY, got ${resReady.status}: ${JSON.stringify(resReady.body)}`);
        }

        // Step 5: Staff moves READY -> COMPLETED
        const resComplete = await request(app)
            .patch(`/api/staff/orders/${orderId}/status`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ status: 'COMPLETED' });

        if (resComplete.status !== 200) {
            throw new Error(`Expected 200 on transition to COMPLETED, got ${resComplete.status}: ${JSON.stringify(resComplete.body)}`);
        }

        orderRecord = await prisma.order.findUnique({ where: { id: orderId } });
        if (orderRecord?.status !== 'COMPLETED') {
            throw new Error(`Expected final status to be COMPLETED, got ${orderRecord?.status}`);
        }
    });

    await assertTest('Strict state machine: invalid transitions rejected with HTTP 400', async () => {
        // Create a test order
        const order = await prisma.order.create({
            data: {
                customerId: customer!.id,
                shopId: shop.id,
                status: 'PLACED',
                totalAmount: 100
            }
        });
        createdOrderIds.push(order.id);

        // Test 1: Skipping states: PLACED -> COMPLETED must be rejected
        const resSkip = await request(app)
            .patch(`/api/staff/orders/${order.id}/status`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ status: 'COMPLETED' });

        if (resSkip.status !== 400) {
            throw new Error(`Expected 400 on illegal transition PLACED -> COMPLETED, got ${resSkip.status}`);
        }

        // Move to PREPARING
        await prisma.order.update({ where: { id: order.id }, data: { status: 'PREPARING' } });

        // Test 2: Cannot cancel once preparation has begun: PREPARING -> CANCELLED must be rejected
        const resCancelPrep = await request(app)
            .patch(`/api/orders/${order.id}/cancel`)
            .set('Authorization', `Bearer ${customerToken}`);

        if (resCancelPrep.status !== 400) {
            throw new Error(`Expected 400 on cancelling order in PREPARING status, got ${resCancelPrep.status}`);
        }

        // Move to COMPLETED (terminal state)
        await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } });

        // Test 3: Terminal state cannot transition: COMPLETED -> CANCELLED must be rejected
        const resCancelCompleted = await request(app)
            .patch(`/api/orders/${order.id}/cancel`)
            .set('Authorization', `Bearer ${customerToken}`);

        if (resCancelCompleted.status !== 400) {
            throw new Error(`Expected 400 on cancelling COMPLETED order, got ${resCancelCompleted.status}`);
        }

        const resStaffCancelCompleted = await request(app)
            .patch(`/api/staff/orders/${order.id}/status`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ status: 'CANCELLED' });

        if (resStaffCancelCompleted.status !== 400) {
            throw new Error(`Expected 400 on staff attempting COMPLETED -> CANCELLED, got ${resStaffCancelCompleted.status}`);
        }
    });

    await assertTest('Cancellation allowed from PAYMENT_PENDING and PLACED states', async () => {
        // Cancellation from PAYMENT_PENDING
        const order1 = await prisma.order.create({
            data: {
                customerId: customer!.id,
                shopId: shop.id,
                status: 'PAYMENT_PENDING',
                totalAmount: 50
            }
        });
        createdOrderIds.push(order1.id);

        const resCancelPending = await request(app)
            .patch(`/api/orders/${order1.id}/cancel`)
            .set('Authorization', `Bearer ${customerToken}`);

        if (resCancelPending.status !== 200) {
            throw new Error(`Expected 200 on cancelling PAYMENT_PENDING order, got ${resCancelPending.status}: ${JSON.stringify(resCancelPending.body)}`);
        }

        // Cancellation from PLACED
        const order2 = await prisma.order.create({
            data: {
                customerId: customer!.id,
                shopId: shop.id,
                status: 'PLACED',
                totalAmount: 50
            }
        });
        createdOrderIds.push(order2.id);

        const resCancelPlaced = await request(app)
            .patch(`/api/orders/${order2.id}/cancel`)
            .set('Authorization', `Bearer ${customerToken}`);

        if (resCancelPlaced.status !== 200) {
            throw new Error(`Expected 200 on cancelling PLACED order, got ${resCancelPlaced.status}: ${JSON.stringify(resCancelPlaced.body)}`);
        }
    });

    // ==========================================
    // 4. PAYMENT WEBHOOK SIGNATURE & IDEMPOTENCY
    // ==========================================
    await assertTest('Payment webhook: signature verification rejects unauthorized requests', async () => {
        const res = await request(app)
            .post('/api/orders/webhook/payment')
            .set('x-webhook-signature', 'invalid_signature_xyz')
            .send({ event: 'payment.success', orderId: 1 });

        if (res.status !== 401) {
            throw new Error(`Expected 401 on invalid webhook signature, got ${res.status}`);
        }
    });

    await assertTest('Payment webhook: signature verification succeeds and processes payment idempotently', async () => {
        const order = await prisma.order.create({
            data: {
                customerId: customer!.id,
                shopId: shop.id,
                status: 'PAYMENT_PENDING',
                totalAmount: 120,
                payments: {
                    create: { amount: 120, status: 'PENDING' }
                }
            }
        });
        createdOrderIds.push(order.id);

        const webhookPayload = {
            event: 'payment.success',
            orderId: order.id,
            amount: 120,
            paymentId: `pay_sim_${Date.now()}`
        };
        const payloadStr = JSON.stringify(webhookPayload);
        const validSignature = generateWebhookSignature(payloadStr);

        // Webhook attempt 1: First delivery
        const res1 = await request(app)
            .post('/api/orders/webhook/payment')
            .set('Content-Type', 'application/json')
            .set('x-webhook-signature', validSignature)
            .send(payloadStr);

        if (res1.status !== 200) {
            throw new Error(`Expected 200 on valid webhook, got ${res1.status}: ${JSON.stringify(res1.body)}`);
        }

        const updatedOrder = await prisma.order.findUnique({
            where: { id: order.id },
            include: { payments: true }
        });

        if (updatedOrder?.status !== 'PLACED') {
            throw new Error(`Expected order to transition to PLACED, got ${updatedOrder?.status}`);
        }
        if (updatedOrder?.payments[0]?.status !== 'SUCCESS') {
            throw new Error(`Expected payment attempt to be SUCCESS, got ${updatedOrder?.payments[0]?.status}`);
        }

        // Webhook attempt 2: Duplicate webhook delivery
        const res2 = await request(app)
            .post('/api/orders/webhook/payment')
            .set('Content-Type', 'application/json')
            .set('x-webhook-signature', validSignature)
            .send(payloadStr);

        if (res2.status !== 200) {
            throw new Error(`Expected 200 on duplicate webhook, got ${res2.status}`);
        }
        if (res2.body.status !== 'already_processed') {
            throw new Error(`Expected already_processed response on replay, got ${JSON.stringify(res2.body)}`);
        }
    });

    // ==========================================
    // 5. AUTOBOOK JOB CLAIMING & EXECUTION LOGS
    // ==========================================
    await assertTest('Autobook scheduler: atomic job claiming and execution audit logging', async () => {
        const testDate = `2099-01-01`;

        // Create an Autobook schedule for the customer
        const schedule = await prisma.autobookSchedule.create({
            data: {
                userId: customer!.id,
                shopId: shop.id,
                itemId: availableItem.id,
                quantity: 2,
                scheduledTime: '12:00',
                isActive: true,
                lastRunDate: null
            }
        });
        createdScheduleIds.push(schedule.id);

        // Execution 1: First worker claims and executes
        const execResult1 = await claimAndExecuteSchedule(schedule.id, { forceDate: testDate });
        if (execResult1.status !== 'SUCCESS') {
            throw new Error(`Expected SUCCESS on first autobook execution, got ${execResult1.status}: ${execResult1.errorMessage}`);
        }

        if (!execResult1.orderId) {
            throw new Error('Autobook execution did not return created orderId');
        }
        createdOrderIds.push(execResult1.orderId);

        // Verify order in database
        const createdOrder = await prisma.order.findUnique({
            where: { id: execResult1.orderId },
            include: { items: true, payments: true }
        });

        if (!createdOrder) {
            throw new Error('Created autobook order not found in database');
        }
        if (createdOrder.paymentMethod !== 'AUTOBOOK_RECURRING') {
            throw new Error(`Expected paymentMethod AUTOBOOK_RECURRING, got ${createdOrder.paymentMethod}`);
        }

        // Verify execution audit log
        const logs = await prisma.autobookExecutionLog.findMany({
            where: { scheduleId: schedule.id }
        });

        if (logs.length === 0) {
            throw new Error('Autobook execution log was not written to database');
        }
        const successLog = logs.find(l => l.status === 'SUCCESS');
        if (!successLog || successLog.orderId !== execResult1.orderId) {
            throw new Error(`Audit log entry mismatch: expected orderId ${execResult1.orderId}, got ${successLog?.orderId}`);
        }

        // Execution 2: Concurrent/duplicate worker attempts to execute on the same day
        const execResult2 = await claimAndExecuteSchedule(schedule.id, { forceDate: testDate });
        if (execResult2.status !== 'SKIPPED') {
            throw new Error(`Expected duplicate claiming to be SKIPPED, got ${execResult2.status}`);
        }

        // Verify no second order was created for this schedule and day
        const totalOrdersForSchedule = await prisma.order.count({
            where: { idempotencyKey: `autobook-${schedule.id}-${testDate}` }
        });
        if (totalOrdersForSchedule !== 1) {
            throw new Error(`Expected exactly 1 order created, found ${totalOrdersForSchedule}`);
        }
    });

    await assertTest('Autobook scheduler: pre-verification detects sold out items and logs failure', async () => {
        // Temporarily create a sold-out item
        const soldOutItem = await prisma.foodItem.create({
            data: {
                shopId: shop.id,
                categoryId: availableItem.categoryId,
                name: 'Temporary Sold Out Samosa',
                price: 30,
                isAvailable: false
            }
        });

        const schedule = await prisma.autobookSchedule.create({
            data: {
                userId: customer!.id,
                shopId: shop.id,
                itemId: soldOutItem.id,
                quantity: 1,
                scheduledTime: '13:00',
                isActive: true
            }
        });
        createdScheduleIds.push(schedule.id);

        const execResult = await claimAndExecuteSchedule(schedule.id, {
            forceDate: `2099-01-02`,
            bypassClaim: true
        });

        if (execResult.status !== 'SKIPPED' && execResult.status !== 'FAILED') {
            throw new Error(`Expected sold out item execution to fail or skip, got ${execResult.status}`);
        }

        const log = await prisma.autobookExecutionLog.findFirst({
            where: { scheduleId: schedule.id, status: { in: ['SKIPPED', 'FAILED'] } }
        });

        if (!log || !log.errorMessage?.includes('sold out')) {
            throw new Error(`Expected log with sold out message, found: ${log?.errorMessage}`);
        }

        // Clean up temporary item
        await prisma.autobookSchedule.delete({ where: { id: schedule.id } });
        await prisma.foodItem.delete({ where: { id: soldOutItem.id } });
    });

    await assertTest('Autobook schedule management: pause, resume, edit, cancel endpoints', async () => {
        // 1. Create schedule via API
        const resCreate = await request(app)
            .post('/api/autobook/schedules')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                shopId: shop.id,
                itemId: availableItem.id,
                quantity: 1,
                scheduledTime: '15:30',
                isActive: true
            });

        if (resCreate.status !== 201) {
            throw new Error(`Expected 201 on schedule create, got ${resCreate.status}: ${JSON.stringify(resCreate.body)}`);
        }
        const scheduleId = resCreate.body.schedule.id;
        createdScheduleIds.push(scheduleId);

        // 2. Pause schedule (toggle)
        const resPause = await request(app)
            .patch(`/api/autobook/schedules/${scheduleId}/toggle`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ isActive: false });

        if (resPause.status !== 200 || resPause.body.schedule.isActive !== false) {
            throw new Error(`Expected schedule to be paused, got: ${JSON.stringify(resPause.body)}`);
        }

        // 3. Resume schedule
        const resResume = await request(app)
            .patch(`/api/autobook/schedules/${scheduleId}/toggle`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ isActive: true });

        if (resResume.status !== 200 || resResume.body.schedule.isActive !== true) {
            throw new Error(`Expected schedule to be resumed, got: ${JSON.stringify(resResume.body)}`);
        }

        // 4. Edit schedule
        const resEdit = await request(app)
            .put(`/api/autobook/schedules/${scheduleId}`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ quantity: 3, scheduledTime: '16:00' });

        if (resEdit.status !== 200 || resEdit.body.schedule.quantity !== 3 || resEdit.body.schedule.scheduledTime !== '16:00') {
            throw new Error(`Expected schedule updated with quantity 3 and time 16:00, got: ${JSON.stringify(resEdit.body)}`);
        }

        // 5. Cancel / Delete schedule
        const resDelete = await request(app)
            .delete(`/api/autobook/schedules/${scheduleId}`)
            .set('Authorization', `Bearer ${customerToken}`);

        if (resDelete.status !== 200) {
            throw new Error(`Expected 200 on schedule delete, got ${resDelete.status}`);
        }

        const verifyDeleted = await prisma.autobookSchedule.findUnique({ where: { id: scheduleId } });
        if (verifyDeleted) {
            throw new Error('Schedule was not deleted from database');
        }
    });

    // ==========================================
    // CLEANUP TEST DATA
    // ==========================================
    try {
        if (createdOrderIds.length > 0) {
            await prisma.order.deleteMany({
                where: { id: { in: createdOrderIds } }
            });
        }
        if (createdScheduleIds.length > 0) {
            await prisma.autobookSchedule.deleteMany({
                where: { id: { in: createdScheduleIds } }
            });
        }
    } catch (cleanupErr) {
        console.warn('Test cleanup notice:', cleanupErr);
    }

    console.log('====================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite()
    .catch((err) => {
        console.error('Fatal test error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
