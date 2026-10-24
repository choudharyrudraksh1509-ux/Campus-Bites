process.env.NODE_ENV = 'test';
process.env.DISABLE_RATE_LIMIT = 'true';

import http from 'http';
import { performance } from 'perf_hooks';
import app from '../src/app';
import prisma from '../src/db/prisma';
import { ensureStallStaffSeeded } from '../src/services/seedService';

async function measureStage(name: string, iterations: number, fn: () => Promise<void>) {
    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        await fn();
        times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const min = times[0];
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(
        `${name.padEnd(38)} | Avg: ${avg.toFixed(2).padStart(7)} ms | p50: ${p50.toFixed(2).padStart(7)} ms | p95: ${p95.toFixed(2).padStart(7)} ms | Min: ${min.toFixed(2).padStart(7)} ms`
    );
    return { name, avg, p50, p95, min };
}

async function main() {
    await ensureStallStaffSeeded();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    let adminToken = '';
    let staffToken = '';
    let customerToken = '';

    console.log('========================================================================================================');
    console.log('🚀 OPTIMIZED STAGE-BY-STAGE LATENCY BENCHMARK (AFTER OPTIMIZATION)');
    console.log('========================================================================================================');

    // 1. Admin Login
    await measureStage('1. Admin Login (POST /auth/login)', 5, async () => {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@campusbites.com', password: 'password123' })
        });
        const data: any = await res.json();
        adminToken = data.token;
    });

    // 2. Staff Login
    await measureStage('2. Staff Login (POST /auth/login)', 5, async () => {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'staff.freshjuices@campusbites.com', password: 'password123', shopId: 3 })
        });
        const data: any = await res.json();
        staffToken = data.token;
    });

    // 3. Customer Login
    await measureStage('3. Customer Login (POST /auth/login)', 8, async () => {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'arjun.sharma@vitstudent.ac.in', password: 'password123' })
        });
        const data: any = await res.json();
        customerToken = data.token;
    });

    // 4. Concurrent Login Burst (15 simultaneous users logging in)
    await measureStage('4. Concurrent Login Burst (15 users)', 3, async () => {
        await Promise.all(
            Array.from({ length: 15 }, (_, idx) =>
                fetch(`${baseUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                        idx % 3 === 0
                            ? { email: 'staff.gazebo1@campusbites.com', password: 'password123', shopId: 1 }
                            : { email: 'arjun.sharma@vitstudent.ac.in', password: 'password123' }
                    )
                }).then(r => r.json())
            )
        );
    });

    // 5. Session Hydration (GET /auth/me)
    await measureStage('5. Session Hydration (GET /auth/me)', 15, async () => {
        await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${staffToken}` }
        }).then(r => r.json());
    });

    // 6. Browse Outlets (GET /shops)
    await measureStage('6. Browse Outlets (GET /shops)', 15, async () => {
        await fetch(`${baseUrl}/api/shops`).then(r => r.json());
    });

    // 7. Stall Menu 49 Items (GET /shops/3/menu)
    await measureStage('7. Stall Menu 49 Items (/shops/3/menu)', 15, async () => {
        await fetch(`${baseUrl}/api/shops/3/menu`).then(r => r.json());
    });

    // 8. Staff Active Queue (GET /staff/orders)
    await measureStage('8. Staff Active Queue (/staff/orders)', 15, async () => {
        await fetch(`${baseUrl}/api/staff/orders`, {
            headers: { Authorization: `Bearer ${staffToken}` }
        }).then(r => r.json());
    });

    // 9. Closing Clearance Toggle (POST /staff/dynamic-pricing/closing-clearance)
    let toggleState = true;
    await measureStage('9. Closing Clearance Toggle (49 items)', 6, async () => {
        await fetch(`${baseUrl}/api/staff/dynamic-pricing/closing-clearance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
            body: JSON.stringify({ isClosingSoon: toggleState, discountPercent: 20, onlySurplus: false })
        }).then(r => r.json());
        toggleState = !toggleState;
    });

    // 10. Admin All Stalls (GET /admin/stalls)
    await measureStage('10. Admin All Stalls (/admin/stalls)', 10, async () => {
        await fetch(`${baseUrl}/api/admin/stalls`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        }).then(r => r.json());
    });

    // 11. Admin Overview Stats (GET /admin/stats)
    await measureStage('11. Admin Overview Stats (/admin/stats)', 10, async () => {
        await fetch(`${baseUrl}/api/admin/stats`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        }).then(r => r.json());
    });

    // 12. Admin Reports (GET /admin/reports)
    await measureStage('12. Admin Reports (/admin/reports)', 10, async () => {
        await fetch(`${baseUrl}/api/admin/reports`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        }).then(r => r.json());
    });

    // 13. Place Order (POST /orders)
    const createdIds: number[] = [];
    const shop3Item = await prisma.foodItem.findFirst({ where: { shopId: 3, isAvailable: true } });
    await measureStage('13. Place Order (POST /orders)', 10, async () => {
        const res = await fetch(`${baseUrl}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
            body: JSON.stringify({
                shopId: 3,
                items: [{ itemId: shop3Item!.id, quantity: 1 }],
                paymentMethod: 'UPI'
            })
        });
        const d: any = await res.json();
        if (d?.order?.id) createdIds.push(d.order.id);
    });

    if (createdIds.length > 0) {
        await prisma.order.deleteMany({ where: { id: { in: createdIds } } });
    }

    // 14. High-Population Campus Stress Test (50 concurrent virtual users, 500 mixed requests)
    console.log('========================================================================================================');
    console.log('🔥 HIGH-POPULATION CONCURRENT CAMPUS STRESS TEST (50 Virtual Users, 500 Mixed Requests)');
    console.log('========================================================================================================');
    const concurrency = 50;
    const requestsPerWorker = 10;
    const totalStressReqs = concurrency * requestsPerWorker;
    const stressLatencies: number[] = [];
    let stressSuccess = 0;
    let stressFailures = 0;

    const stressStart = performance.now();
    await Promise.all(
        Array.from({ length: concurrency }, async (_, workerIdx) => {
            for (let r = 0; r < requestsPerWorker; r++) {
                const reqIdx = workerIdx * requestsPerWorker + r;
                const t0 = performance.now();
                let res: Response;
                const mod = reqIdx % 10;
                if (mod < 3) {
                    res = await fetch(`${baseUrl}/api/shops`);
                } else if (mod < 6) {
                    res = await fetch(`${baseUrl}/api/shops/${(reqIdx % 11) + 1}/menu`);
                } else if (mod === 6) {
                    res = await fetch(`${baseUrl}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: 'arjun.sharma@vitstudent.ac.in', password: 'password123' })
                    });
                } else if (mod === 7) {
                    res = await fetch(`${baseUrl}/api/auth/me`, {
                        headers: { Authorization: `Bearer ${customerToken}` }
                    });
                } else if (mod === 8) {
                    res = await fetch(`${baseUrl}/api/staff/orders`, {
                        headers: { Authorization: `Bearer ${staffToken}` }
                    });
                } else {
                    res = await fetch(`${baseUrl}/api/orders/queue-estimate/3`, {
                        headers: { Authorization: `Bearer ${customerToken}` }
                    });
                }
                await res.text();
                stressLatencies.push(performance.now() - t0);
                if (res.ok) stressSuccess++;
                else stressFailures++;
            }
        })
    );
    const stressDurationSec = (performance.now() - stressStart) / 1000;
    stressLatencies.sort((a, b) => a - b);
    const sAvg = stressLatencies.reduce((a, b) => a + b, 0) / stressLatencies.length;
    const sP50 = stressLatencies[Math.floor(stressLatencies.length * 0.5)];
    const sP95 = stressLatencies[Math.floor(stressLatencies.length * 0.95)];
    const sP99 = stressLatencies[Math.floor(stressLatencies.length * 0.99)];
    console.log(
        `Total: ${totalStressReqs} reqs (${stressSuccess} OK, ${stressFailures} Failed) | Throughput: ${(totalStressReqs / stressDurationSec).toFixed(2)} req/sec`
    );
    console.log(
        `Latency -> Avg: ${sAvg.toFixed(2)} ms | p50: ${sP50.toFixed(2)} ms | p95: ${sP95.toFixed(2)} ms | p99: ${sP99.toFixed(2)} ms`
    );
    console.log('========================================================================================================');

    server.close();
    await prisma.$disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
