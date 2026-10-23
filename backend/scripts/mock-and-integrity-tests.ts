process.env.NODE_ENV = 'test';
process.env.DEMO_MODE = 'false';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/db/prisma';
import { env } from '../src/config/env';

async function runMockAndIntegrityTests() {
    console.log('================================================================');
    console.log('🧪 RUNNING MOCK DATA REJECTION & DATABASE INTEGRITY SUITE');
    console.log('================================================================\n');

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

    const generateToken = (payload: { userId: number; role: string; shopId?: number; email?: string }) => {
        return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });
    };

    // Prepare test entities in the database
    let testUserA = await prisma.user.findFirst({
        where: { email: 'integrity.userA@campusbites.test' }
    });
    if (!testUserA) {
        testUserA = await prisma.user.create({
            data: {
                fullName: 'Integrity Customer Alpha',
                email: 'integrity.userA@campusbites.test',
                passwordHash: 'dummyhash'
            }
        });
    }

    let testUserB = await prisma.user.findFirst({
        where: { email: 'integrity.userB@campusbites.test' }
    });
    if (!testUserB) {
        testUserB = await prisma.user.create({
            data: {
                fullName: 'Integrity Customer Beta',
                email: 'integrity.userB@campusbites.test',
                passwordHash: 'dummyhash'
            }
        });
    }

    const tokenA = generateToken({ userId: testUserA.id, role: 'CUSTOMER' });
    const tokenB = generateToken({ userId: testUserB.id, role: 'CUSTOMER' });

    const activeShops = await prisma.shop.findMany({
        where: { status: 'ACTIVE' },
        include: { items: { where: { isAvailable: true } } },
        take: 2
    });

    if (activeShops.length < 2) {
        throw new Error('Test suite requires at least 2 active shops in the database');
    }

    const shop1 = activeShops[0];
    const shop2 = activeShops[1];

    if (!shop1.items.length || !shop2.items.length) {
        throw new Error('Both test shops must have at least one menu item');
    }

    const item1 = shop1.items[0];
    const item2 = shop2.items[0];

    console.log('--- PART 1: MOCK DATA & SIMULATED FALLBACK REJECTION ---');

    // 1. Unauthenticated Order Placement Rejection
    await assertTest('Unauthenticated order request is rejected with 401 (no fake order created)', async () => {
        const res = await request(app)
            .post('/api/orders')
            .send({
                shopId: shop1.id,
                items: [{ itemId: item1.id, quantity: 1 }]
            });
        if (res.status !== 401) {
            throw new Error(`Expected 401 Unauthorized, received ${res.status}`);
        }
    });

    // 2. Invalid Item ID Order Placement Rejection
    await assertTest('Non-existent item ID in order payload is rejected without fabricating order', async () => {
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                shopId: shop1.id,
                items: [{ itemId: 999999, quantity: 1 }]
            });
        if (res.status === 200 || res.status === 201) {
            throw new Error(`Expected error for invalid item ID, but received ${res.status}`);
        }
    });

    // 3. Cross-Outlet Item Mixing Rejection
    await assertTest('Cross-stall item mixing is rejected and does not silently proceed', async () => {
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                shopId: shop1.id,
                items: [
                    { itemId: item1.id, quantity: 1 },
                    { itemId: item2.id, quantity: 1 } // belongs to shop2!
                ]
            });
        if (res.status === 200 || res.status === 201) {
            throw new Error(`Expected cross-outlet order rejection, but received ${res.status}`);
        }
    });

    // 4. Client Price Tampering Rejection
    await assertTest('Client-tampered prices are ignored; server authoritative DB price is enforced', async () => {
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                shopId: shop1.id,
                items: [{ itemId: item1.id, quantity: 2, price: 0.01 }] // attempting ₹0.01
            });
        if (res.status !== 201) {
            throw new Error(`Expected 201 Created, received ${res.status}: ${JSON.stringify(res.body)}`);
        }

        const expectedTotal = item1.price * 2;
        if (Math.abs(res.body.total_amount - expectedTotal) > 0.01) {
            throw new Error(`Expected total ${expectedTotal}, got ${res.body.total_amount}`);
        }

        // Clean up created order
        if (res.body.orderId) {
            await prisma.order.delete({ where: { id: res.body.orderId } });
        }
    });

    // 5. Review Rejection Without Verified Purchase
    await assertTest('Submitting review without a completed order returns 403 and does not inject fake review', async () => {
        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', `Bearer ${tokenB}`)
            .send({
                shopId: shop1.id,
                rating: 5,
                comment: 'Fabricated unverified review'
            });
        if (res.status !== 403) {
            throw new Error(`Expected 403 Forbidden for unverified review, received ${res.status}`);
        }
    });

    // 6. Shop Reviews Endpoint Returns Real Database Records, Never Synthetic Reviews in Non-Demo Mode
    await assertTest('Shop reviews endpoint returns real data and never injects in-memory mock reviews', async () => {
        // Query reviews for shop1
        const res = await request(app).get(`/api/reviews/shop/${shop1.id}`);
        if (res.status !== 200) {
            throw new Error(`Expected 200, received ${res.status}`);
        }

        const actualCount = await prisma.review.count({ where: { shopId: shop1.id } });
        if (res.body.totalReviews !== actualCount) {
            throw new Error(`Expected totalReviews to equal DB review count (${actualCount}), got ${res.body.totalReviews}`);
        }
        if (actualCount === 0 && res.body.reviews.length !== 0) {
            throw new Error(`Expected empty reviews array when DB has 0 reviews, got ${res.body.reviews.length}`);
        }
    });

    // 7. Cross-Customer Order Cancellation Rejection
    await assertTest('Customer B cannot cancel Customer A order (ownership enforcement)', async () => {
        // Create an order for Customer A
        const created = await prisma.order.create({
            data: {
                customerId: testUserA.id,
                shopId: shop1.id,
                status: 'PLACED',
                totalAmount: item1.price,
                items: {
                    create: [{ itemId: item1.id, quantity: 1, priceAtOrder: item1.price }]
                }
            }
        });

        try {
            const res = await request(app)
                .patch(`/api/orders/${created.id}/cancel`)
                .set('Authorization', `Bearer ${tokenB}`);
            if (res.status !== 403) {
                throw new Error(`Expected 403 Forbidden when Customer B cancels Customer A's order, got ${res.status}`);
            }
        } finally {
            await prisma.order.delete({ where: { id: created.id } });
        }
    });

    console.log('\n--- PART 2: DATABASE INTEGRITY & CONSTRAINTS ---');

    // 8. User Email Uniqueness
    await assertTest('User email uniqueness constraint is enforced (Prisma P2002)', async () => {
        try {
            await prisma.user.create({
                data: {
                    fullName: 'Duplicate Email User',
                    email: testUserA.email,
                    passwordHash: 'dummy'
                }
            });
            throw new Error('Expected duplicate user insertion to fail with P2002, but it succeeded');
        } catch (err: any) {
            if (err.code === 'P2002') return;
            throw err;
        }
    });

    // 9. ShopStaff Compound Uniqueness
    await assertTest('ShopStaff compound uniqueness [shopId, staffId] prevents duplicates', async () => {
        let existing = await prisma.shopStaff.findFirst();
        let createdNew = false;
        if (!existing) {
            existing = await prisma.shopStaff.create({
                data: { shopId: shop1.id, staffId: testUserA.id }
            });
            createdNew = true;
        }

        try {
            await prisma.shopStaff.create({
                data: {
                    shopId: existing.shopId,
                    staffId: existing.staffId
                }
            });
            throw new Error('Expected duplicate ShopStaff creation to fail, but it succeeded');
        } catch (err: any) {
            if (err.code === 'P2002') return;
            throw err;
        } finally {
            if (createdNew && existing) {
                await prisma.shopStaff.delete({ where: { id: existing.id } });
            }
        }
    });

    // 10. Review Order Uniqueness
    await assertTest('Review orderId uniqueness enforces strictly one review per order', async () => {
        const order = await prisma.order.create({
            data: {
                customerId: testUserA.id,
                shopId: shop1.id,
                status: 'COMPLETED',
                totalAmount: item1.price
            }
        });

        const rev1 = await prisma.review.create({
            data: {
                orderId: order.id,
                customerId: testUserA.id,
                shopId: shop1.id,
                rating: 5,
                comment: 'First legitimate review'
            }
        });

        try {
            await prisma.review.create({
                data: {
                    orderId: order.id,
                    customerId: testUserA.id,
                    shopId: shop1.id,
                    rating: 4,
                    comment: 'Duplicate second review for same order'
                }
            });
            throw new Error('Expected duplicate review for same orderId to fail, but succeeded');
        } catch (err: any) {
            if (err.code === 'P2002') return;
            throw err;
        } finally {
            await prisma.review.delete({ where: { id: rev1.id } });
            await prisma.order.delete({ where: { id: order.id } });
        }
    });

    // 11. Foreign Key: Order -> Customer
    await assertTest('Foreign key constraint rejects Order with non-existent customerId', async () => {
        try {
            await prisma.order.create({
                data: {
                    customerId: 9999999,
                    shopId: shop1.id,
                    status: 'PLACED',
                    totalAmount: 100
                }
            });
            throw new Error('Expected foreign key error for non-existent customerId');
        } catch (err: any) {
            if (err.code === 'P2003' || err.message.includes('Foreign key')) return;
            throw err;
        }
    });

    // 12. Foreign Key: Order -> Shop
    await assertTest('Foreign key constraint rejects Order with non-existent shopId', async () => {
        try {
            await prisma.order.create({
                data: {
                    customerId: testUserA.id,
                    shopId: 9999999,
                    status: 'PLACED',
                    totalAmount: 100
                }
            });
            throw new Error('Expected foreign key error for non-existent shopId');
        } catch (err: any) {
            if (err.code === 'P2003' || err.message.includes('Foreign key')) return;
            throw err;
        }
    });

    // 13. Cascade Delete: Order -> OrderItems & PaymentAttempts
    await assertTest('Cascade deletion removes OrderItem and PaymentAttempt on Order deletion without deleting Shop or Customer', async () => {
        const order = await prisma.order.create({
            data: {
                customerId: testUserA.id,
                shopId: shop1.id,
                status: 'PLACED',
                totalAmount: item1.price * 2,
                items: {
                    create: [{ itemId: item1.id, quantity: 2, priceAtOrder: item1.price }]
                },
                payments: {
                    create: { amount: item1.price * 2, status: 'SUCCESS' }
                }
            },
            include: { items: true, payments: true }
        });

        const orderItemId = order.items[0].id;
        const paymentId = order.payments[0].id;

        // Delete order
        await prisma.order.delete({ where: { id: order.id } });

        // Verify child records cascaded
        const foundItem = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
        if (foundItem) throw new Error('OrderItem was not cascade-deleted');

        const foundPayment = await prisma.paymentAttempt.findUnique({ where: { id: paymentId } });
        if (foundPayment) throw new Error('PaymentAttempt was not cascade-deleted');

        // Verify Customer and Shop remain intact (Restrict behavior)
        const checkUser = await prisma.user.findUnique({ where: { id: testUserA.id } });
        if (!checkUser) throw new Error('Customer was unexpectedly deleted');

        const checkShop = await prisma.shop.findUnique({ where: { id: shop1.id } });
        if (!checkShop) throw new Error('Shop was unexpectedly deleted');
    });

    // 14. Monetary Precision and Historical Snapshot Verification
    await assertTest('Monetary precision: Order preserves snapshot price even if menu item price changes', async () => {
        const originalPrice = item1.price;
        const snapshotPrice = 85.50;

        const order = await prisma.order.create({
            data: {
                customerId: testUserA.id,
                shopId: shop1.id,
                status: 'PLACED',
                totalAmount: snapshotPrice * 3,
                items: {
                    create: [{ itemId: item1.id, quantity: 3, priceAtOrder: snapshotPrice }]
                }
            },
            include: { items: true }
        });

        try {
            // Simulate shop owner updating the menu item price in DB
            await prisma.foodItem.update({
                where: { id: item1.id },
                data: { price: 120.00 }
            });

            // Verify order item still holds its historical snapshot price
            const checkOrder = await prisma.order.findUnique({
                where: { id: order.id },
                include: { items: true }
            });

            if (checkOrder?.items[0].priceAtOrder !== snapshotPrice) {
                throw new Error(`Snapshot price violated! Expected ${snapshotPrice}, got ${checkOrder?.items[0].priceAtOrder}`);
            }
        } finally {
            // Restore original price
            await prisma.foodItem.update({
                where: { id: item1.id },
                data: { price: originalPrice }
            });
            await prisma.order.delete({ where: { id: order.id } });
        }
    });

    // 15. Autobook Foreign Key Integrity
    await assertTest('AutobookSchedule foreign key enforces valid User, Shop, and FoodItem', async () => {
        try {
            await prisma.autobookSchedule.create({
                data: {
                    userId: 9999999, // non-existent
                    shopId: shop1.id,
                    itemId: item1.id,
                    scheduledTime: '09:00'
                }
            });
            throw new Error('Expected foreign key error on invalid userId in AutobookSchedule');
        } catch (err: any) {
            if (err.code === 'P2003' || err.message.includes('Foreign key')) return;
            throw err;
        }
    });

    console.log('\n================================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================');

    await prisma.$disconnect();

    if (failed > 0) {
        process.exit(1);
    }
}

runMockAndIntegrityTests().catch(async (err) => {
    console.error('Test execution fatal error:', err);
    await prisma.$disconnect();
    process.exit(1);
});
