process.env.NODE_ENV = 'test';
process.env.DISABLE_RATE_LIMIT = 'true';

import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import prisma from '../../src/db/prisma';
import { env } from '../../src/config/env';

interface RequestMetric {
    operation: string;
    durationMs: number;
    statusCode: number;
    isError: boolean;
    timestamp: number;
}

async function runRealisticLoadTest() {
    console.log('====================================================');
    console.log('🚀 CAMPUS BITES - REALISTIC CONCURRENT LOAD TEST RUNNER');
    console.log('====================================================');

    // 1. Start ephemeral HTTP server on dynamic port
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[Init] Ephemeral test server active on port ${port}`);

    try {
        // 2. Fetch test fixtures from database
        const shops = await prisma.shop.findMany({
            include: { items: { where: { isAvailable: true } } },
            take: 5
        });

        if (shops.length === 0 || !shops.some(s => s.items.length > 0)) {
            throw new Error('Database lacks active stalls or food items to conduct load testing');
        }

        const validShop = shops.find(s => s.items.length > 0)!;
        const validItem = validShop.items[0];

        // Ensure a test customer user exists
        let loadUser = await prisma.user.findFirst({
            where: { email: 'loadtest.user@campusbites.test' }
        });
        if (!loadUser) {
            loadUser = await prisma.user.create({
                data: {
                    fullName: 'Load Test Worker User',
                    email: 'loadtest.user@campusbites.test',
                    passwordHash: 'dummy-load-hash'
                }
            });
        }

        const customerToken = jwt.sign(
            { userId: loadUser.id, role: 'CUSTOMER', email: loadUser.email },
            env.JWT_SECRET,
            { expiresIn: '2h', algorithm: 'HS256' }
        );

        const staffToken = jwt.sign(
            { userId: loadUser.id, role: 'STAFF', shopId: validShop.id, email: loadUser.email },
            env.JWT_SECRET,
            { expiresIn: '2h', algorithm: 'HS256' }
        );

        // 3. Test Configuration
        const TOTAL_REQUESTS = 160;
        const CONCURRENCY = 8;
        console.log(`[Config] Total Operations: ${TOTAL_REQUESTS} | Concurrency: ${CONCURRENCY} workers`);
        console.log(`[Config] Simulating mixed realistic student & kitchen traffic:`);
        console.log(`         - 40% Browse Outlets (/api/shops)`);
        console.log(`         - 30% Browse Menus (/api/shops/:id)`);
        console.log(`         - 15% Staff Queue Checks (/api/staff/orders & /queue-estimate)`);
        console.log(`         - 15% Place Real Orders (/api/orders)`);

        const createdOrderIds: number[] = [];
        const metrics: RequestMetric[] = [];
        let completedCount = 0;

        // Helper to execute single timed HTTP request
        async function executeOperation(workerId: number, opIndex: number): Promise<RequestMetric> {
            const rand = Math.random();
            let opName = '';
            let path = '';
            let method = 'GET';
            let headers: Record<string, string> = {
                'x-load-test': 'bypass'
            };
            let body: any = null;

            if (rand < 0.40) {
                // Browse outlets
                opName = 'Browse Outlets';
                path = '/api/shops';
            } else if (rand < 0.70) {
                // View stall menu
                opName = 'View Stall Menu';
                path = `/api/shops/${validShop.id}`;
            } else if (rand < 0.85) {
                // Staff queue / kitchen check
                opName = 'Staff Queue Check';
                path = '/api/staff/orders';
                headers['Authorization'] = `Bearer ${staffToken}`;
            } else {
                // Place order
                opName = 'Place Order';
                path = '/api/orders';
                method = 'POST';
                headers['Authorization'] = `Bearer ${customerToken}`;
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify({
                    shopId: validShop.id,
                    items: [{ itemId: validItem.id, quantity: 1 }],
                    paymentMethod: 'ONLINE_DEMO'
                });
            }

            const startTime = performance.now();
            let statusCode = 0;
            let isError = false;

            try {
                const response = await fetch(`${baseUrl}${path}`, {
                    method,
                    headers,
                    body: body ? body : undefined
                });
                statusCode = response.status;
                const json: any = await response.json().catch(() => null);

                if (opName === 'Place Order' && json?.order?.id) {
                    createdOrderIds.push(json.order.id);
                }

                if (!response.ok) {
                    isError = true;
                }
            } catch (err) {
                statusCode = 500;
                isError = true;
            }

            const durationMs = performance.now() - startTime;
            return {
                operation: opName,
                durationMs,
                statusCode,
                isError,
                timestamp: Date.now()
            };
        }

        // 4. Execution Pool with bounded concurrency
        const startTestWallClock = performance.now();
        let currentReqIndex = 0;

        async function worker(workerId: number) {
            while (true) {
                const idx = currentReqIndex++;
                if (idx >= TOTAL_REQUESTS) break;

                const metric = await executeOperation(workerId, idx);
                metrics.push(metric);
                completedCount++;

                if (completedCount % 50 === 0 || completedCount === TOTAL_REQUESTS) {
                    process.stdout.write(`  [Progress] ${completedCount}/${TOTAL_REQUESTS} requests finished...\r`);
                }
            }
        }

        console.log('\n[Running] Dispatching operations across concurrent workers...');
        const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
        await Promise.all(workers);
        const totalDurationSec = (performance.now() - startTestWallClock) / 1000;
        console.log(`\n[Complete] Finished ${completedCount} operations in ${totalDurationSec.toFixed(2)}s\n`);

        // 5. Calculations & Statistical Analysis
        const allLatencies = metrics.map(m => m.durationMs).sort((a, b) => a - b);
        const errors = metrics.filter(m => m.isError);
        const errorRate = (errors.length / metrics.length) * 100;
        const throughput = metrics.length / totalDurationSec;

        const p50 = allLatencies[Math.floor(allLatencies.length * 0.50)];
        const p90 = allLatencies[Math.floor(allLatencies.length * 0.90)];
        const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)];
        const p99 = allLatencies[Math.floor(allLatencies.length * 0.99)];
        const avg = allLatencies.reduce((sum, v) => sum + v, 0) / allLatencies.length;
        const min = allLatencies[0];
        const max = allLatencies[allLatencies.length - 1];

        console.log('====================================================');
        console.log('📊 PERFORMANCE & THROUGHPUT BENCHMARK RESULTS');
        console.log('====================================================');
        console.log(`Total Requests Processed: ${metrics.length}`);
        console.log(`Test Duration:            ${totalDurationSec.toFixed(2)} seconds`);
        console.log(`Concurrency Level:        ${CONCURRENCY} virtual users`);
        console.log(`Throughput (RPS):         ${throughput.toFixed(2)} req/sec`);
        console.log(`Error Count:              ${errors.length}`);
        console.log(`Error Rate:               ${errorRate.toFixed(2)}%`);
        console.log('----------------------------------------------------');
        console.log('LATENCY DISTRIBUTION (round-trip processing):');
        console.log(`  Min Latency:     ${min.toFixed(1)} ms`);
        console.log(`  Median (p50):    ${p50.toFixed(1)} ms`);
        console.log(`  Average:         ${avg.toFixed(1)} ms`);
        console.log(`  p90:             ${p90.toFixed(1)} ms`);
        console.log(`  p95:             ${p95.toFixed(1)} ms`);
        console.log(`  p99:             ${p99.toFixed(1)} ms`);
        console.log(`  Max Latency:     ${max.toFixed(1)} ms`);
        console.log('----------------------------------------------------');
        console.log('PER-OPERATION BREAKDOWN:');
        console.log(
            'Operation'.padEnd(22) +
            'Count'.padEnd(8) +
            'Errors'.padEnd(9) +
            'Median(ms)'.padEnd(13) +
            'p95(ms)'
        );

        const opGroups: Record<string, RequestMetric[]> = {};
        for (const m of metrics) {
            opGroups[m.operation] = opGroups[m.operation] || [];
            opGroups[m.operation].push(m);
        }

        for (const [op, list] of Object.entries(opGroups)) {
            const lats = list.map(l => l.durationMs).sort((a, b) => a - b);
            const opErrors = list.filter(l => l.isError).length;
            const opP50 = lats[Math.floor(lats.length * 0.50)];
            const opP95 = lats[Math.floor(lats.length * 0.95)];

            console.log(
                op.padEnd(22) +
                String(list.length).padEnd(8) +
                String(opErrors).padEnd(9) +
                opP50.toFixed(1).padEnd(13) +
                opP95.toFixed(1)
            );
        }
        console.log('====================================================');

        // 6. Database Cleanup of test generated orders
        if (createdOrderIds.length > 0) {
            console.log(`[Cleanup] Cleaning up ${createdOrderIds.length} generated test orders...`);
            await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
            await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: createdOrderIds } } });
            await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
            console.log('[Cleanup] Test orders successfully pruned.');
        }

    } finally {
        server.close();
        await prisma.$disconnect();
    }
}

runRealisticLoadTest().catch((err) => {
    console.error('Fatal load test error:', err);
    process.exit(1);
});
