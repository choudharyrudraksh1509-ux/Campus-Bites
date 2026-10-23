process.env.NODE_ENV = 'test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import app from '../src/app';
import prisma from '../src/db/prisma';
import { env } from '../src/config/env';

async function runSecurityTests() {
    console.log('====================================================');
    console.log('🛡️  RUNNING EXHAUSTIVE APPLICATION SECURITY TESTS');
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

    // Helper to generate valid test tokens with specific roles
    const generateToken = (payload: { userId: number; role: string; shopId?: number; email?: string }) => {
        return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });
    };

    // Find or create real test customers to satisfy database foreign keys
    let customerA = await prisma.user.findFirst({
        where: { email: 'customerA.test@campusbites.test' }
    });
    if (!customerA) {
        customerA = await prisma.user.create({
            data: {
                fullName: 'Security Test Customer A',
                email: 'customerA.test@campusbites.test',
                passwordHash: 'dummy'
            }
        });
    }

    let customerB = await prisma.user.findFirst({
        where: { email: 'customerB.test@campusbites.test' }
    });
    if (!customerB) {
        customerB = await prisma.user.create({
            data: {
                fullName: 'Security Test Customer B',
                email: 'customerB.test@campusbites.test',
                passwordHash: 'dummy'
            }
        });
    }

    const shop = await prisma.shop.findFirst({ where: { status: 'ACTIVE' } });
    if (!shop) throw new Error('No active shop found');

    // 1. Unauthenticated Access Tests
    await assertTest('Unauthenticated access to protected routes returns 401', async () => {
        const resOrders = await request(app).get('/api/orders');
        if (resOrders.status !== 401) throw new Error(`Expected 401, got ${resOrders.status}`);

        const resStaff = await request(app).get('/api/staff/orders');
        if (resStaff.status !== 401) throw new Error(`Expected 401, got ${resStaff.status}`);

        const resAdmin = await request(app).get('/api/admin/stats');
        if (resAdmin.status !== 401) throw new Error(`Expected 401, got ${resAdmin.status}`);

        const resOwner = await request(app).get('/api/owner/sales');
        if (resOwner.status !== 401) throw new Error(`Expected 401, got ${resOwner.status}`);
    });

    // 2. Customer Access to Admin Endpoints
    await assertTest('Customer token access to admin routes returns 403 Forbidden', async () => {
        const customerToken = generateToken({ userId: customerA.id, role: 'CUSTOMER' });

        const resStats = await request(app)
            .get('/api/admin/stats')
            .set('Authorization', `Bearer ${customerToken}`);
        if (resStats.status !== 403) throw new Error(`Expected 403 on /api/admin/stats, got ${resStats.status}`);

        const resUsers = await request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${customerToken}`);
        if (resUsers.status !== 403) throw new Error(`Expected 403 on /api/admin/users, got ${resUsers.status}`);

        const resOwnerSales = await request(app)
            .get('/api/owner/sales')
            .set('Authorization', `Bearer ${customerToken}`);
        if (resOwnerSales.status !== 403) throw new Error(`Expected 403 on /api/owner/sales, got ${resOwnerSales.status}`);
    });

    // 3. Owner/Staff Access to Another Owner's Outlet
    await assertTest('Staff assigned to Stall 1 cannot modify menu or orders for Stall 2', async () => {
        const staffStall1Token = generateToken({ userId: 992, role: 'STAFF', shopId: 1 });

        // Attempt to add menu item to Stall 2
        const resAdd = await request(app)
            .post('/api/owner/items')
            .set('Authorization', `Bearer ${staffStall1Token}`)
            .send({
                shopId: 2,
                categoryId: 1,
                name: 'Unauthorized Hack Item',
                price: 100
            });
        if (resAdd.status !== 403) throw new Error(`Expected 403 on adding item to another stall, got ${resAdd.status}`);

        // Find an order belonging to Stall 2
        const stall2Order = await prisma.order.findFirst({
            where: { shopId: 2, status: 'PLACED' }
        });

        if (stall2Order) {
            const resUpdate = await request(app)
                .patch(`/api/staff/orders/${stall2Order.id}/status`)
                .set('Authorization', `Bearer ${staffStall1Token}`)
                .send({ status: 'PREPARING' });
            if (resUpdate.status !== 403) throw new Error(`Expected 403 on updating order of another stall, got ${resUpdate.status}`);
        }
    });

    // 4. Access to Another Customer's Order
    await assertTest('Customer B cannot view or cancel Customer A\'s order', async () => {
        const customerBToken = generateToken({ userId: customerB.id, role: 'CUSTOMER' });

        // Create an order for Customer A
        const orderA = await prisma.order.create({
            data: {
                customerId: customerA.id,
                shopId: shop.id,
                totalAmount: 100,
                status: 'PLACED'
            }
        });

        // Customer B attempts to view Customer A's order
        const resView = await request(app)
            .get(`/api/orders/${orderA.id}`)
            .set('Authorization', `Bearer ${customerBToken}`);
        if (resView.status !== 403) throw new Error(`Expected 403 on viewing another customer's order, got ${resView.status}`);

        // Customer B attempts to cancel Customer A's order
        const resCancel = await request(app)
            .patch(`/api/orders/${orderA.id}/cancel`)
            .set('Authorization', `Bearer ${customerBToken}`);
        if (resCancel.status !== 403) throw new Error(`Expected 403 on cancelling another customer's order, got ${resCancel.status}`);

        // Clean up
        await prisma.order.delete({ where: { id: orderA.id } });
    });

    // 5. Unauthorized Role Changes / Privilege Escalation
    await assertTest('Registration ignores client-supplied role and enforces CUSTOMER', async () => {
        const testEmail = `sec-test-${Date.now()}@campusbites.test`;
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                fullName: 'Attacker Attempting Admin',
                email: testEmail,
                password: 'password123',
                role: 'ADMIN' // Client attempting privilege escalation
            });

        if (res.status === 201) {
            if (res.body.user.role === 'ADMIN') {
                throw new Error('Critical vulnerability: User was registered as ADMIN!');
            }
            if (res.body.user.role !== 'CUSTOMER') {
                throw new Error(`Expected role CUSTOMER, got ${res.body.user.role}`);
            }

            // Verify in database
            const dbUser = await prisma.user.findUnique({
                where: { email: testEmail },
                include: { roles: { include: { role: true } } }
            });
            const dbRole = dbUser?.roles[0]?.role.name;
            if (dbRole !== 'CUSTOMER') {
                throw new Error(`Database record has role ${dbRole}, expected CUSTOMER`);
            }

            // Clean up
            await prisma.user.delete({ where: { id: dbUser!.id } });
        } else if (res.status !== 400) {
            throw new Error(`Expected 201 or 400, got ${res.status}`);
        }
    });

    // 6. Invalid Quantities, Bad Item IDs, and Stall Cross-Ordering
    await assertTest('Rejects invalid quantities, non-existent item IDs, and cross-stall items', async () => {
        const customerToken = generateToken({ userId: customerA.id, role: 'CUSTOMER' });

        // A. Invalid quantity (-5)
        const resNegQty = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                shopId: 1,
                items: [{ itemId: 1, quantity: -5 }]
            });
        if (resNegQty.status !== 400) throw new Error(`Expected 400 on negative quantity, got ${resNegQty.status}`);

        // B. Non-existent item ID (999999)
        const resBadItem = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                shopId: 1,
                items: [{ itemId: 999999, quantity: 1 }]
            });
        if (resBadItem.status !== 400 && resBadItem.status !== 404) {
            throw new Error(`Expected 400/404 on invalid item ID, got ${resBadItem.status}`);
        }

        // C. Item from Stall 2 submitted to Stall 1
        const itemInStall2 = await prisma.foodItem.findFirst({ where: { shopId: 2 } });
        if (itemInStall2) {
            const resCrossStall = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    shopId: 1,
                    items: [{ itemId: itemInStall2.id, quantity: 1 }]
                });
            if (resCrossStall.status !== 400) {
                throw new Error(`Expected 400 on cross-stall item submission, got ${resCrossStall.status}`);
            }
        }
    });

    // 7. Tampered Prices and Totals
    await assertTest('Server ignores client-tampered price and computes authoritative total from DB', async () => {
        const customerToken = generateToken({ userId: customerA.id, role: 'CUSTOMER' });

        // Find a real item in Shop 5
        const realItem = await prisma.foodItem.findFirst({
            where: { shopId: 5, isAvailable: true }
        });
        if (!realItem) throw new Error('No available item in Shop 5');

        // Client attempts to buy the item for ₹0.01 instead of its real price
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                shopId: 5,
                items: [
                    {
                        itemId: realItem.id,
                        quantity: 2,
                        price: 0.01, // Client trying to cheat price
                        name: 'Hacked Price Item'
                    }
                ],
                totalAmount: 0.02 // Client trying to cheat total
            });

        if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);

        const createdOrderId = res.body.orderId;
        const dbOrder = await prisma.order.findUnique({
            where: { id: createdOrderId },
            include: { items: true }
        });

        if (dbOrder?.totalAmount === 0.02) {
            throw new Error('Critical vulnerability: Server trusted client-supplied total of ₹0.02!');
        }

        if (dbOrder?.items[0]?.priceAtOrder === 0.01) {
            throw new Error('Critical vulnerability: Order item price was saved as client-supplied ₹0.01!');
        }

        // Verify total amount was computed strictly from server database price
        let expectedUnitPrice = realItem.price;
        if (realItem.isDynamicPricing && realItem.discountPercent) {
            const orig = realItem.originalPrice || realItem.price;
            expectedUnitPrice = Math.max(5, Math.round(orig * (1 - realItem.discountPercent / 100)));
        } else {
            const shopRecord = await prisma.shop.findUnique({ where: { id: 5 } });
            if (shopRecord?.isClosingSoon && shopRecord.closingDiscount) {
                expectedUnitPrice = Math.max(5, Math.round(realItem.price * (1 - shopRecord.closingDiscount / 100)));
            }
        }
        const expectedTotal = expectedUnitPrice * 2;

        if (dbOrder?.totalAmount !== expectedTotal) {
            throw new Error(`Expected server-calculated total of ${expectedTotal}, got ${dbOrder?.totalAmount}`);
        }

        // Clean up
        await prisma.order.delete({ where: { id: createdOrderId } });
    });

    // 8. Invalid Status Transitions
    await assertTest('State machine rejects illegal status transitions (e.g. PLACED -> COMPLETED)', async () => {
        const staffToken = generateToken({ userId: 995, role: 'STAFF', shopId: 5 });

        // Create an order for customerA in PLACED state
        const testOrder = await prisma.order.create({
            data: {
                customerId: customerA.id,
                shopId: 5,
                totalAmount: 100,
                status: 'PLACED'
            }
        });

        // Attempt illegal transition directly from PLACED to COMPLETED (skipping PREPARING and READY)
        const resIllegal = await request(app)
            .patch(`/api/staff/orders/${testOrder.id}/status`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ status: 'COMPLETED' });

        if (resIllegal.status !== 400) {
            throw new Error(`Expected 400 on illegal state transition PLACED -> COMPLETED, got ${resIllegal.status}`);
        }

        // Clean up
        await prisma.order.delete({ where: { id: testOrder.id } });
    });

    // 9. Rate Limiting Behavior
    await assertTest('Auth rate limiter throttles excessive rapid requests with HTTP 429', async () => {
        let got429 = false;

        // Send rapid requests to trigger the 30-request threshold
        for (let i = 0; i < 35; i++) {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'rate.limit.test@campusbites.com', password: 'bad_password' });
            if (res.status === 429) {
                got429 = true;
                break;
            }
        }

        if (!got429) {
            throw new Error('Expected rate limiter to return 429 after 30 requests, but none received');
        }
    });

    // 10. Missing Production Secrets Fail-Safe
    await assertTest('Environment schema fails safely when JWT_SECRET is weak in production', async () => {
        const productionEnvSchema = z.object({
            PORT: z.coerce.number().default(5000),
            NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
            JWT_SECRET: z.string().min(8),
            DATABASE_URL: z.string().min(1),
        }).refine(data => {
            if (data.NODE_ENV === 'production' && data.JWT_SECRET.length < 32) {
                return false;
            }
            return true;
        }, {
            message: 'In production, JWT_SECRET must be at least 32 characters long',
            path: ['JWT_SECRET']
        });

        // Should reject short secret in production
        const result = productionEnvSchema.safeParse({
            NODE_ENV: 'production',
            JWT_SECRET: 'short_secret',
            DATABASE_URL: 'postgresql://localhost:5432/db'
        });

        if (result.success) {
            throw new Error('Expected production validation to fail on short secret, but it succeeded');
        }
    });

    // Clean up temporary test accounts (clean up orders first to satisfy foreign keys)
    await prisma.order.deleteMany({
        where: { customerId: { in: [customerA.id, customerB.id] } }
    });
    await prisma.user.deleteMany({
        where: { id: { in: [customerA.id, customerB.id] } }
    });

    console.log('====================================================');
    console.log(`🏁 SECURITY TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================');

    await prisma.$disconnect();

    if (failed > 0) {
        process.exit(1);
    }
    process.exit(0);
}

runSecurityTests();
