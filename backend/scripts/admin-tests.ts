process.env.NODE_ENV = 'test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/db/prisma';
import { env } from '../src/config/env';

async function runAdminTests() {
    console.log('====================================================');
    console.log('🛡️  RUNNING COMPREHENSIVE ADMIN PORTAL TEST SUITE');
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

    const generateToken = (payload: { userId: number; role: string; email?: string }) => {
        return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });
    };

    // 1. Setup Test Admin User
    let testAdmin = await prisma.user.findFirst({
        where: { email: 'admin.test@campusbites.test' },
        include: { roles: { include: { role: true } } }
    });

    if (!testAdmin) {
        testAdmin = await prisma.user.create({
            data: {
                fullName: 'Test System Administrator',
                email: 'admin.test@campusbites.test',
                passwordHash: 'dummy-hash',
                isActive: true
            },
            include: { roles: { include: { role: true } } }
        });
    }

    const adminRole = await prisma.role.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: { name: 'ADMIN' }
    });

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: testAdmin.id, roleId: adminRole.id } },
        update: {},
        create: { userId: testAdmin.id, roleId: adminRole.id }
    });

    // 2. Setup Test Customer User
    let testCustomer = await prisma.user.findFirst({
        where: { email: 'customer.test@campusbites.test' }
    });

    if (!testCustomer) {
        testCustomer = await prisma.user.create({
            data: {
                fullName: 'Test Regular Student',
                email: 'customer.test@campusbites.test',
                passwordHash: 'dummy-hash',
                isActive: true
            }
        });
    }

    const customerRole = await prisma.role.upsert({
        where: { name: 'CUSTOMER' },
        update: {},
        create: { name: 'CUSTOMER' }
    });

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: testCustomer.id, roleId: customerRole.id } },
        update: {},
        create: { userId: testCustomer.id, roleId: customerRole.id }
    });

    // 3. Ensure an Area and Owner exist for outlet tests
    let testArea = await prisma.area.findFirst();
    if (!testArea) {
        testArea = await prisma.area.create({
            data: { name: 'Admin Test Food Court', description: 'Test area for admin tests' }
        });
    }

    const adminToken = generateToken({ userId: testAdmin.id, role: 'ADMIN', email: testAdmin.email });
    const customerToken = generateToken({ userId: testCustomer.id, role: 'CUSTOMER', email: testCustomer.email });

    // Test 1: Customer token rejected with 403 Forbidden
    await assertTest('Customer token access to admin routes returns 403 Forbidden', async () => {
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Authorization', `Bearer ${customerToken}`);

        if (res.status !== 403) {
            throw new Error(`Expected HTTP 403, got ${res.status}: ${JSON.stringify(res.body)}`);
        }
    });

    // Test 2: Unauthenticated access rejected with 401 Unauthorized
    await assertTest('Unauthenticated access to admin routes returns 401 Unauthorized', async () => {
        const res = await request(app).get('/api/admin/stats');
        if (res.status !== 401) {
            throw new Error(`Expected HTTP 401, got ${res.status}: ${JSON.stringify(res.body)}`);
        }
    });

    // Test 3: Admin stats aggregation returns real database metrics
    await assertTest('Admin stats aggregation returns real database metrics and structure', async () => {
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Authorization', `Bearer ${adminToken}`);

        if (res.status !== 200) {
            throw new Error(`Expected HTTP 200, got ${res.status}: ${JSON.stringify(res.body)}`);
        }

        const data = res.body;
        if (!data.summary || typeof data.summary.totalRevenue !== 'number') {
            throw new Error('Missing summary.totalRevenue');
        }
        if (!Array.isArray(data.stallPerformance)) {
            throw new Error('Missing stallPerformance array');
        }
        if (!Array.isArray(data.hourlyDistribution) || data.hourlyDistribution.length !== 24) {
            throw new Error('hourlyDistribution must have 24 hours');
        }
        if (!Array.isArray(data.dailyTrend)) {
            throw new Error('Missing dailyTrend array');
        }
        if (!data.statusBreakdown || typeof data.statusBreakdown.COMPLETED !== 'number') {
            throw new Error('Missing statusBreakdown');
        }
    });

    // Test 4: Outlet creation with validation and audit logging
    let createdShopId: number | null = null;
    await assertTest('Outlet creation validates input and records audit log', async () => {
        const outletName = `Admin Test Stall ${Date.now()}`;
        const res = await request(app)
            .post('/api/admin/stalls')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: outletName,
                areaId: testArea!.id,
                ownerId: testAdmin!.id
            });

        if (res.status !== 201) {
            throw new Error(`Expected HTTP 201, got ${res.status}: ${JSON.stringify(res.body)}`);
        }

        createdShopId = res.body.stall.id;
        if (!createdShopId) throw new Error('No stall id returned');

        // Verify audit log exists
        const audit = await prisma.auditLog.findFirst({
            where: {
                action: 'CREATE_STALL',
                entity: 'SHOP',
                entityId: createdShopId
            }
        });

        if (!audit) {
            throw new Error('Audit log for CREATE_STALL was not created');
        }
    });

    // Test 5: Outlet update with audit logging
    await assertTest('Outlet update modifies settings and records audit log', async () => {
        if (!createdShopId) throw new Error('Previous test did not set createdShopId');

        const res = await request(app)
            .patch(`/api/admin/stalls/${createdShopId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                isClosingSoon: true,
                closingDiscount: 30,
                status: 'ACTIVE'
            });

        if (res.status !== 200) {
            throw new Error(`Expected HTTP 200, got ${res.status}: ${JSON.stringify(res.body)}`);
        }

        if (res.body.stall.isClosingSoon !== true || res.body.stall.closingDiscount !== 30) {
            throw new Error('Stall fields were not properly updated');
        }

        // Verify audit log exists
        const audit = await prisma.auditLog.findFirst({
            where: {
                action: 'UPDATE_STALL',
                entity: 'SHOP',
                entityId: createdShopId
            }
        });

        if (!audit) {
            throw new Error('Audit log for UPDATE_STALL was not created');
        }
    });

    // Test 6: View stall staff & menu endpoints
    await assertTest('View stall staff and menu endpoints return valid arrays', async () => {
        if (!createdShopId) throw new Error('createdShopId not set');

        const staffRes = await request(app)
            .get(`/api/admin/stalls/${createdShopId}/staff`)
            .set('Authorization', `Bearer ${adminToken}`);

        if (staffRes.status !== 200 || !Array.isArray(staffRes.body)) {
            throw new Error(`Expected HTTP 200 array for staff, got ${staffRes.status}`);
        }

        const menuRes = await request(app)
            .get(`/api/admin/stalls/${createdShopId}/menu`)
            .set('Authorization', `Bearer ${adminToken}`);

        if (menuRes.status !== 200 || !Array.isArray(menuRes.body)) {
            throw new Error(`Expected HTTP 200 array for menu, got ${menuRes.status}`);
        }
    });

    // Test 7: User directory pagination and search
    await assertTest('User directory supports pagination, search, and role filtering', async () => {
        const res = await request(app)
            .get('/api/admin/users?page=1&limit=5&role=CUSTOMER')
            .set('Authorization', `Bearer ${adminToken}`);

        if (res.status !== 200) {
            throw new Error(`Expected HTTP 200, got ${res.status}: ${JSON.stringify(res.body)}`);
        }

        if (!Array.isArray(res.body.users) || typeof res.body.total !== 'number') {
            throw new Error('User directory must return { users, total, page, totalPages }');
        }

        if (res.body.users.length > 5) {
            throw new Error(`Limit not respected: expected <= 5, got ${res.body.users.length}`);
        }
    });

    // Test 8: Lockout protection for the last remaining active admin
    await assertTest('Lockout protection prevents demoting or deactivating the last active administrator', async () => {
        // Ensure only testAdmin is the active admin
        const otherAdmins = await prisma.userRole.findMany({
            where: {
                role: { name: 'ADMIN' },
                userId: { not: testAdmin!.id }
            },
            include: { user: true }
        });

        // Temporarily deactivate or remove other admins to test single-admin lockout
        for (const oa of otherAdmins) {
            await prisma.user.update({
                where: { id: oa.userId },
                data: { isActive: false }
            });
        }

        // Try to demote testAdmin to CUSTOMER
        const demoteRes = await request(app)
            .patch(`/api/admin/users/${testAdmin!.id}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'CUSTOMER' });

        if (demoteRes.status !== 400) {
            throw new Error(`Expected HTTP 400 Bad Request for demoting last admin, got ${demoteRes.status}: ${JSON.stringify(demoteRes.body)}`);
        }

        // Try to deactivate testAdmin
        const deactivateRes = await request(app)
            .patch(`/api/admin/users/${testAdmin!.id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ isActive: false });

        if (deactivateRes.status !== 400) {
            throw new Error(`Expected HTTP 400 Bad Request for deactivating last admin, got ${deactivateRes.status}: ${JSON.stringify(deactivateRes.body)}`);
        }

        // Restore other admins active state
        for (const oa of otherAdmins) {
            await prisma.user.update({
                where: { id: oa.userId },
                data: { isActive: true }
            });
        }
    });

    // Test 9: Order status lifecycle enforcement and payment verification
    await assertTest('Order status update rejects illegal transitions and unverified payment skips', async () => {
        // Create an unpaid test order with PAYMENT_PENDING status
        const unpaidOrder = await prisma.order.create({
            data: {
                customerId: testCustomer!.id,
                shopId: createdShopId!,
                status: 'PAYMENT_PENDING',
                totalAmount: 150,
                paymentMethod: 'ONLINE'
            }
        });

        // Attempt to transition PAYMENT_PENDING to PLACED without payment transaction
        const illegalPlacedRes = await request(app)
            .patch(`/api/admin/orders/${unpaidOrder.id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'PLACED' });

        if (illegalPlacedRes.status !== 400) {
            throw new Error(`Expected HTTP 400 for skipping payment, got ${illegalPlacedRes.status}`);
        }

        // Attempt illegal jump to COMPLETED
        const illegalCompletedRes = await request(app)
            .patch(`/api/admin/orders/${unpaidOrder.id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'COMPLETED' });

        if (illegalCompletedRes.status !== 400) {
            throw new Error(`Expected HTTP 400 for illegal state jump, got ${illegalCompletedRes.status}`);
        }

        // Clean up test order
        await prisma.order.delete({ where: { id: unpaidOrder.id } });
    });

    // Test 10: Audit logs endpoint
    await assertTest('Audit logs endpoint returns structured history with admin details and pagination', async () => {
        const res = await request(app)
            .get('/api/admin/audit-logs?page=1&limit=10')
            .set('Authorization', `Bearer ${adminToken}`);

        if (res.status !== 200) {
            throw new Error(`Expected HTTP 200, got ${res.status}: ${JSON.stringify(res.body)}`);
        }

        if (!Array.isArray(res.body.logs) || typeof res.body.total !== 'number') {
            throw new Error('Audit logs response must include logs array and total');
        }

        if (res.body.logs.length > 0) {
            const firstLog = res.body.logs[0];
            if (!firstLog.action || !firstLog.entity || !firstLog.admin?.fullName) {
                throw new Error('Audit log must include action, entity, and admin info');
            }
        }
    });

    // Test 11: Reports endpoint
    await assertTest('Reports endpoint returns structured volume, outlet ranking, and verified revenue', async () => {
        const res = await request(app)
            .get('/api/admin/reports')
            .set('Authorization', `Bearer ${adminToken}`);

        if (res.status !== 200) {
            throw new Error(`Expected HTTP 200, got ${res.status}: ${JSON.stringify(res.body)}`);
        }

        const data = res.body;
        if (!data.summary || typeof data.summary.totalVerifiedRevenue !== 'number') {
            throw new Error('Reports summary must contain totalVerifiedRevenue');
        }
        if (!Array.isArray(data.ordersPerDay)) {
            throw new Error('Reports must contain ordersPerDay array');
        }
        if (!Array.isArray(data.outletPerformance)) {
            throw new Error('Reports must contain outletPerformance array');
        }
        if (!Array.isArray(data.statusDistribution)) {
            throw new Error('Reports must contain statusDistribution array');
        }
    });

    console.log('====================================================');
    console.log(`🏁 ADMIN TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runAdminTests()
    .catch(err => {
        console.error('Fatal test error:', err);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
