/**
 * Database & API Performance Benchmark Runner for Campus Bites
 * 
 * Executes representative queries across all 7 operational scenarios:
 * 1. Customer order history
 * 2. Staff active-order queue
 * 3. Menu retrieval for a specific outlet
 * 4. Outlet search and filtering
 * 5. Admin dashboard summaries (Unbounded findMany vs DB aggregate/groupBy)
 * 6. Review retrieval
 * 7. Autobook schedule lookup
 * 
 * Measures real latency over 15 iterations per query (min, median, max, p95)
 * Captures real EXPLAIN (ANALYZE, BUFFERS) plans on PostgreSQL:
 * - Sequential Scans vs Index Scans vs Bitmap Scans
 * - Buffer hits and disk reads
 * - In-memory Quicksort elimination
 * 
 * Generates raw CSV data at docs/benchmark-results/query-benchmarks.csv
 * 
 * Usage:
 *   npx tsx scripts/benchmark/run-benchmarks.ts
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import prisma from '../../src/db/prisma';

interface RunSample {
    queryName: string;
    stage: 'BASELINE' | 'OPTIMIZED';
    iteration: number;
    latencyMs: number;
    planningTimeMs: number;
    executionTimeMs: number;
    scanType: string;
    sharedHitBuffers: number;
    sharedReadBuffers: number;
    sortMethod: string;
    planSummary: string;
}

interface BenchmarkSummary {
    queryName: string;
    baselineMedianMs: number;
    baselineP95Ms: number;
    baselineBuffers: number;
    baselineScan: string;
    optimizedMedianMs: number;
    optimizedP95Ms: number;
    optimizedBuffers: number;
    optimizedScan: string;
    speedup: number;
    bufferReductionPercent: number;
}

const NEW_INDEXES = [
    {
        name: 'Order_customerId_orderTime_idx',
        table: 'Order',
        sql: `CREATE INDEX IF NOT EXISTS "Order_customerId_orderTime_idx" ON "Order"("customerId", "orderTime" DESC);`
    },
    {
        name: 'Order_shopId_status_orderTime_idx',
        table: 'Order',
        sql: `CREATE INDEX IF NOT EXISTS "Order_shopId_status_orderTime_idx" ON "Order"("shopId", "status", "orderTime" ASC);`
    },
    {
        name: 'FoodItem_shopId_isAvailable_idx',
        table: 'FoodItem',
        sql: `CREATE INDEX IF NOT EXISTS "FoodItem_shopId_isAvailable_idx" ON "FoodItem"("shopId", "isAvailable");`
    },
    {
        name: 'Review_shopId_createdAt_idx',
        table: 'Review',
        sql: `CREATE INDEX IF NOT EXISTS "Review_shopId_createdAt_idx" ON "Review"("shopId", "createdAt" DESC);`
    },
    {
        name: 'AutobookSchedule_userId_createdAt_idx',
        table: 'AutobookSchedule',
        sql: `CREATE INDEX IF NOT EXISTS "AutobookSchedule_userId_createdAt_idx" ON "AutobookSchedule"("userId", "createdAt" DESC);`
    }
];

// Helper: Calculate statistical percentiles
function getPercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Number(sorted[Math.max(0, Math.min(index, sorted.length - 1))].toFixed(2));
}

// Helper: Parse EXPLAIN (ANALYZE, BUFFERS) plan output
function parseExplainPlan(rawPlanRows: any[]): {
    planningTimeMs: number;
    executionTimeMs: number;
    sharedHitBuffers: number;
    sharedReadBuffers: number;
    scanType: string;
    sortMethod: string;
    fullText: string;
} {
    const textLines = rawPlanRows.map(r => r['QUERY PLAN'] || String(r));
    const fullText = textLines.join('\n');

    let planningTimeMs = 0;
    let executionTimeMs = 0;
    let sharedHitBuffers = 0;
    let sharedReadBuffers = 0;
    let scanType = 'Index Scan';
    let sortMethod = 'None (Index Ordered)';

    for (const line of textLines) {
        if (line.includes('Planning Time:')) {
            const m = line.match(/Planning Time:\s*([\d\.]+)\s*ms/);
            if (m) planningTimeMs = parseFloat(m[1]);
        }
        if (line.includes('Execution Time:')) {
            const m = line.match(/Execution Time:\s*([\d\.]+)\s*ms/);
            if (m) executionTimeMs = parseFloat(m[1]);
        }
        if (line.includes('Buffers:')) {
            const hitMatch = line.match(/hit=(\d+)/);
            if (hitMatch) sharedHitBuffers += parseInt(hitMatch[1], 10);
            const readMatch = line.match(/read=(\d+)/);
            if (readMatch) sharedReadBuffers += parseInt(readMatch[1], 10);
        }
        if (line.includes('Seq Scan')) {
            scanType = 'Sequential Scan';
        } else if (line.includes('Bitmap Index Scan') || line.includes('Bitmap Heap Scan')) {
            if (scanType !== 'Sequential Scan') scanType = 'Bitmap Scan';
        } else if (line.includes('Index Only Scan')) {
            scanType = 'Index Only Scan';
        } else if (line.includes('Index Scan')) {
            if (scanType !== 'Sequential Scan' && scanType !== 'Bitmap Scan') scanType = 'Index Scan';
        }

        if (line.includes('Sort Method:')) {
            const sortMatch = line.match(/Sort Method:\s*([^ ]+)/);
            if (sortMatch) sortMethod = sortMatch[1];
        }
    }

    return {
        planningTimeMs,
        executionTimeMs,
        sharedHitBuffers,
        sharedReadBuffers,
        scanType,
        sortMethod,
        fullText
    };
}

async function dropBenchmarkIndexes() {
    console.log('🔄 Dropping optimization indexes to measure true baseline...');
    for (const idx of NEW_INDEXES) {
        await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${idx.name}";`);
    }
    console.log('✅ Baseline index state restored.');
}

async function applyBenchmarkIndexes() {
    console.log('\n🚀 Applying targeted composite optimization indexes to PostgreSQL...');
    for (const idx of NEW_INDEXES) {
        await prisma.$executeRawUnsafe(idx.sql);
        console.log(`   + Created: ${idx.name} on ${idx.table}`);
    }
    console.log('✅ All performance indexes created successfully.');
}

async function main() {
    console.log('================================================================');
    console.log('📊 CAMPUS BITES: DATABASE & API QUERY BENCHMARK HARNESS');
    console.log('================================================================\n');

    // Find active test samples in the database
    const sampleCustomer = await prisma.order.findFirst({ select: { customerId: true } });
    const customerId = sampleCustomer?.customerId || 1;

    const sampleShop = await prisma.order.findFirst({ where: { status: 'PLACED' }, select: { shopId: true } })
        || await prisma.order.findFirst({ select: { shopId: true } });
    const shopId = sampleShop?.shopId || 1;

    const sampleUserForAutobook = await prisma.autobookSchedule.findFirst({ select: { userId: true } });
    const autobookUserId = sampleUserForAutobook?.userId || 1;

    console.log(`🎯 Test Targets Resolved:
    - Customer ID:       ${customerId}
    - Shop ID:           ${shopId}
    - Autobook User ID:  ${autobookUserId}`);

    const rawSamples: RunSample[] = [];
    const NUM_ITERATIONS = 15;
    const WARMUP_RUNS = 2;

    // =========================================================================
    // STEP 1: MEASURE BASELINE (UNINDEXED / UNBOUNDED)
    // =========================================================================
    await dropBenchmarkIndexes();

    console.log('\n----------------------------------------------------------------');
    console.log('⏳ PHASE 1: MEASURING BASELINE REAL PERFORMANCE (15 Iterations)');
    console.log('----------------------------------------------------------------');

    // Query 1: Customer Order History
    console.log('1. Customer Order History (Baseline)...');
    let explain1 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "Order" WHERE "customerId" = ${customerId} ORDER BY "orderTime" DESC;`
    );
    let plan1 = parseExplainPlan(explain1);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.order.findMany({
            where: { customerId },
            include: { shop: true, items: { include: { item: true } } },
            orderBy: { orderTime: 'desc' }
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '1. Customer Order History',
                stage: 'BASELINE',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: plan1.planningTimeMs,
                executionTimeMs: plan1.executionTimeMs,
                scanType: plan1.scanType,
                sharedHitBuffers: plan1.sharedHitBuffers,
                sharedReadBuffers: plan1.sharedReadBuffers,
                sortMethod: plan1.sortMethod,
                planSummary: plan1.fullText.split('\n')[0]
            });
        }
    }

    // Query 2: Staff Active-Order Queue (Baseline: NOT IN filter, include all)
    console.log('2. Staff Active-Order Queue (Baseline: Negative Filter + Full Customer Include)...');
    let explain2 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "Order" WHERE "shopId" = ${shopId} AND "status" NOT IN ('COMPLETED', 'CANCELLED', 'PAYMENT_FAILED') ORDER BY "orderTime" ASC;`
    );
    let plan2 = parseExplainPlan(explain2);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.order.findMany({
            where: {
                shopId,
                status: { notIn: ['COMPLETED', 'CANCELLED', 'PAYMENT_FAILED'] }
            },
            include: {
                shop: true,
                items: { include: { item: true } },
                customer: true,
                payments: true
            },
            orderBy: { orderTime: 'asc' }
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '2. Staff Active Queue',
                stage: 'BASELINE',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: plan2.planningTimeMs,
                executionTimeMs: plan2.executionTimeMs,
                scanType: plan2.scanType,
                sharedHitBuffers: plan2.sharedHitBuffers,
                sharedReadBuffers: plan2.sharedReadBuffers,
                sortMethod: plan2.sortMethod,
                planSummary: plan2.fullText.split('\n')[0]
            });
        }
    }

    // Query 3: Menu Retrieval for Specific Outlet (Baseline)
    console.log('3. Outlet Menu Retrieval (Baseline)...');
    let explain3 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "FoodItem" WHERE "shopId" = ${shopId} AND "isAvailable" = true;`
    );
    let plan3 = parseExplainPlan(explain3);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.foodItem.findMany({
            where: { shopId, isAvailable: true },
            include: { category: true, shop: true }
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '3. Outlet Menu Retrieval',
                stage: 'BASELINE',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: plan3.planningTimeMs,
                executionTimeMs: plan3.executionTimeMs,
                scanType: plan3.scanType,
                sharedHitBuffers: plan3.sharedHitBuffers,
                sharedReadBuffers: plan3.sharedReadBuffers,
                sortMethod: plan3.sortMethod,
                planSummary: plan3.fullText.split('\n')[0]
            });
        }
    }

    // Query 4: Outlet Search and Filtering (Baseline)
    console.log('4. Outlet Search & Filtering (Baseline)...');
    let explain4 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "Shop" WHERE "status" = 'ACTIVE';`
    );
    let plan4 = parseExplainPlan(explain4);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.shop.findMany({
            where: { status: 'ACTIVE' },
            include: { area: true }
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '4. Outlet Search & Filter',
                stage: 'BASELINE',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: plan4.planningTimeMs,
                executionTimeMs: plan4.executionTimeMs,
                scanType: plan4.scanType,
                sharedHitBuffers: plan4.sharedHitBuffers,
                sharedReadBuffers: plan4.sharedReadBuffers,
                sortMethod: plan4.sortMethod,
                planSummary: plan4.fullText.split('\n')[0]
            });
        }
    }

    // Query 5: Admin Dashboard Summaries (Baseline: UNBOUNDED findMany of all orders + all items)
    console.log('5. Admin Dashboard Summaries (Baseline: Unbounded findMany on ALL orders & orderItems)...');
    let explain5 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "Order" ORDER BY "orderTime" DESC;`
    );
    let plan5 = parseExplainPlan(explain5);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        // Exact baseline implementation from adminController.ts
        const [allOrders, allOrderItems] = await Promise.all([
            prisma.order.findMany({
                include: {
                    shop: { include: { area: true } },
                    customer: true,
                    items: { include: { item: true } },
                    payments: true
                },
                orderBy: { orderTime: 'desc' }
            }),
            prisma.orderItem.findMany({
                include: { item: { include: { category: true, shop: true } }, order: true }
            })
        ]);

        // Baseline Node.js in-memory loops over thousands of records
        let totalRev = 0;
        allOrders.forEach(o => { if (o.status === 'COMPLETED') totalRev += o.totalAmount; });
        const duration = performance.now() - start;

        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '5. Admin Overview Summary',
                stage: 'BASELINE',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: plan5.planningTimeMs,
                executionTimeMs: plan5.executionTimeMs,
                scanType: plan5.scanType,
                sharedHitBuffers: plan5.sharedHitBuffers,
                sharedReadBuffers: plan5.sharedReadBuffers,
                sortMethod: plan5.sortMethod,
                planSummary: `Unbounded findMany (${allOrders.length} orders + ${allOrderItems.length} items)`
            });
        }
    }

    // Query 6: Review Retrieval (Baseline)
    console.log('6. Review Retrieval (Baseline)...');
    let explain6 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "Review" WHERE "shopId" = ${shopId} ORDER BY "createdAt" DESC;`
    );
    let plan6 = parseExplainPlan(explain6);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.review.findMany({
            where: { shopId },
            include: { customer: true },
            orderBy: { createdAt: 'desc' }
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '6. Review Retrieval',
                stage: 'BASELINE',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: plan6.planningTimeMs,
                executionTimeMs: plan6.executionTimeMs,
                scanType: plan6.scanType,
                sharedHitBuffers: plan6.sharedHitBuffers,
                sharedReadBuffers: plan6.sharedReadBuffers,
                sortMethod: plan6.sortMethod,
                planSummary: plan6.fullText.split('\n')[0]
            });
        }
    }

    // Query 7: Autobook Schedule Lookup (Baseline)
    console.log('7. Autobook Schedule Lookup (Baseline)...');
    let explain7 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM "AutobookSchedule" WHERE "userId" = ${autobookUserId} ORDER BY "createdAt" DESC;`
    );
    let plan7 = parseExplainPlan(explain7);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.autobookSchedule.findMany({
            where: { userId: autobookUserId },
            include: { shop: true, item: true },
            orderBy: { createdAt: 'desc' }
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '7. Autobook Schedule Lookup',
                stage: 'BASELINE',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: plan7.planningTimeMs,
                executionTimeMs: plan7.executionTimeMs,
                scanType: plan7.scanType,
                sharedHitBuffers: plan7.sharedHitBuffers,
                sharedReadBuffers: plan7.sharedReadBuffers,
                sortMethod: plan7.sortMethod,
                planSummary: plan7.fullText.split('\n')[0]
            });
        }
    }

    // =========================================================================
    // STEP 2: APPLY INDEXES & MEASURE OPTIMIZED QUERIES
    // =========================================================================
    await applyBenchmarkIndexes();

    console.log('\n----------------------------------------------------------------');
    console.log('🚀 PHASE 2: MEASURING OPTIMIZED REAL PERFORMANCE (15 Iterations)');
    console.log('----------------------------------------------------------------');

    // Query 1 Optimized: Compound index (customerId, orderTime DESC) + stable id ordering + projected select
    console.log('1. Customer Order History (Optimized: Index Scan + Projection)...');
    let optExplain1 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT id, "shopId", status, "totalAmount", "orderTime" FROM "Order" WHERE "customerId" = ${customerId} ORDER BY "orderTime" DESC;`
    );
    let optPlan1 = parseExplainPlan(optExplain1);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.order.findMany({
            where: { customerId },
            select: {
                id: true,
                shopId: true,
                status: true,
                totalAmount: true,
                orderTime: true,
                isPreorder: true,
                pickupTime: true,
                estimatedMinutes: true,
                queueNumber: true,
                paymentMethod: true,
                shop: { select: { id: true, name: true } },
                items: {
                    select: {
                        id: true,
                        quantity: true,
                        priceAtOrder: true,
                        item: { select: { id: true, name: true, price: true } }
                    }
                }
            },
            orderBy: [{ orderTime: 'desc' }, { id: 'desc' }]
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '1. Customer Order History',
                stage: 'OPTIMIZED',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: optPlan1.planningTimeMs,
                executionTimeMs: optPlan1.executionTimeMs,
                scanType: optPlan1.scanType,
                sharedHitBuffers: optPlan1.sharedHitBuffers,
                sharedReadBuffers: optPlan1.sharedReadBuffers,
                sortMethod: optPlan1.sortMethod,
                planSummary: optPlan1.fullText.split('\n')[0]
            });
        }
    }

    // Query 2 Optimized: Positive IN filter + Compound index (shopId, status, orderTime) + projected select
    console.log('2. Staff Active-Order Queue (Optimized: Positive Filter + Projection + Index Scan)...');
    let optExplain2 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT id, "shopId", status, "totalAmount", "orderTime" FROM "Order" WHERE "shopId" = ${shopId} AND "status" IN ('PLACED', 'PREPARING', 'READY') ORDER BY "orderTime" ASC;`
    );
    let optPlan2 = parseExplainPlan(optExplain2);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.order.findMany({
            where: {
                shopId,
                status: { in: ['PLACED', 'PREPARING', 'READY'] }
            },
            select: {
                id: true,
                shopId: true,
                status: true,
                totalAmount: true,
                orderTime: true,
                isPreorder: true,
                pickupTime: true,
                estimatedMinutes: true,
                queueNumber: true,
                paymentMethod: true,
                customer: { select: { fullName: true, phone: true } },
                items: {
                    select: {
                        id: true,
                        quantity: true,
                        priceAtOrder: true,
                        item: { select: { id: true, name: true, price: true } }
                    }
                }
            },
            orderBy: [{ orderTime: 'asc' }, { id: 'asc' }]
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '2. Staff Active Queue',
                stage: 'OPTIMIZED',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: optPlan2.planningTimeMs,
                executionTimeMs: optPlan2.executionTimeMs,
                scanType: optPlan2.scanType,
                sharedHitBuffers: optPlan2.sharedHitBuffers,
                sharedReadBuffers: optPlan2.sharedReadBuffers,
                sortMethod: optPlan2.sortMethod,
                planSummary: optPlan2.fullText.split('\n')[0]
            });
        }
    }

    // Query 3 Optimized: Composite index (shopId, isAvailable) + projected fields
    console.log('3. Outlet Menu Retrieval (Optimized: Compound Index Scan)...');
    let optExplain3 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT id, name, price, "shopId", "isAvailable" FROM "FoodItem" WHERE "shopId" = ${shopId} AND "isAvailable" = true;`
    );
    let optPlan3 = parseExplainPlan(optExplain3);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.foodItem.findMany({
            where: { shopId, isAvailable: true },
            select: {
                id: true,
                shopId: true,
                categoryId: true,
                name: true,
                description: true,
                price: true,
                originalPrice: true,
                discountPercent: true,
                isDynamicPricing: true,
                category: { select: { name: true } },
                shop: { select: { name: true, isClosingSoon: true, closingDiscount: true } }
            }
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '3. Outlet Menu Retrieval',
                stage: 'OPTIMIZED',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: optPlan3.planningTimeMs,
                executionTimeMs: optPlan3.executionTimeMs,
                scanType: optPlan3.scanType,
                sharedHitBuffers: optPlan3.sharedHitBuffers,
                sharedReadBuffers: optPlan3.sharedReadBuffers,
                sortMethod: optPlan3.sortMethod,
                planSummary: optPlan3.fullText.split('\n')[0]
            });
        }
    }

    // Query 4 Optimized: Projected Shop & Area fields
    console.log('4. Outlet Search & Filtering (Optimized: Specific Fields)...');
    let optExplain4 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT id, name, status, "areaId" FROM "Shop" WHERE status = 'ACTIVE';`
    );
    let optPlan4 = parseExplainPlan(optExplain4);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.shop.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                name: true,
                status: true,
                areaId: true,
                isClosingSoon: true,
                closingDiscount: true,
                area: { select: { id: true, name: true, description: true } }
            }
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '4. Outlet Search & Filter',
                stage: 'OPTIMIZED',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: optPlan4.planningTimeMs,
                executionTimeMs: optPlan4.executionTimeMs,
                scanType: optPlan4.scanType,
                sharedHitBuffers: optPlan4.sharedHitBuffers,
                sharedReadBuffers: optPlan4.sharedReadBuffers,
                sortMethod: optPlan4.sortMethod,
                planSummary: optPlan4.fullText.split('\n')[0]
            });
        }
    }

    // Query 5 Optimized: DB Aggregate + groupBy replacing unbounded findMany!
    console.log('5. Admin Dashboard Summaries (Optimized: DB aggregate & groupBy in SQL)...');
    let optExplain5 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT "status", COUNT(*) as count, SUM("totalAmount") as rev FROM "Order" GROUP BY "status";`
    );
    let optPlan5 = parseExplainPlan(optExplain5);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        // Fully aggregated in SQL engine
        const [
            totalRevenueAgg,
            statusGroups,
            paymentGroups,
            topSellingItems,
            stallStats
        ] = await Promise.all([
            prisma.order.aggregate({
                where: { status: 'COMPLETED' },
                _sum: { totalAmount: true },
                _count: { id: true }
            }),
            prisma.order.groupBy({
                by: ['status'],
                _count: { id: true }
            }),
            prisma.order.groupBy({
                by: ['paymentMethod'],
                _count: { id: true },
                _sum: { totalAmount: true }
            }),
            prisma.orderItem.groupBy({
                by: ['itemId'],
                _sum: { quantity: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 10
            }),
            prisma.order.groupBy({
                by: ['shopId', 'status'],
                _count: { id: true },
                _sum: { totalAmount: true },
                _avg: { estimatedMinutes: true }
            })
        ]);
        const duration = performance.now() - start;

        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '5. Admin Overview Summary',
                stage: 'OPTIMIZED',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: optPlan5.planningTimeMs,
                executionTimeMs: optPlan5.executionTimeMs,
                scanType: optPlan5.scanType,
                sharedHitBuffers: optPlan5.sharedHitBuffers,
                sharedReadBuffers: optPlan5.sharedReadBuffers,
                sortMethod: optPlan5.sortMethod,
                planSummary: 'DB aggregate + groupBy (0 unbounded memory copies)'
            });
        }
    }

    // Query 6 Optimized: Compound index (shopId, createdAt DESC) + projected fields
    console.log('6. Review Retrieval (Optimized: Compound Index Scan)...');
    let optExplain6 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT id, "orderId", rating, comment, "createdAt" FROM "Review" WHERE "shopId" = ${shopId} ORDER BY "createdAt" DESC;`
    );
    let optPlan6 = parseExplainPlan(optExplain6);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.review.findMany({
            where: { shopId },
            select: {
                id: true,
                orderId: true,
                customerId: true,
                shopId: true,
                rating: true,
                comment: true,
                createdAt: true,
                customer: { select: { fullName: true } }
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '6. Review Retrieval',
                stage: 'OPTIMIZED',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: optPlan6.planningTimeMs,
                executionTimeMs: optPlan6.executionTimeMs,
                scanType: optPlan6.scanType,
                sharedHitBuffers: optPlan6.sharedHitBuffers,
                sharedReadBuffers: optPlan6.sharedReadBuffers,
                sortMethod: optPlan6.sortMethod,
                planSummary: optPlan6.fullText.split('\n')[0]
            });
        }
    }

    // Query 7 Optimized: Compound index (userId, createdAt DESC) + projected fields
    console.log('7. Autobook Schedule Lookup (Optimized: Compound Index Scan)...');
    let optExplain7 = await prisma.$queryRawUnsafe<any[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT id, "shopId", "itemId", "scheduledTime" FROM "AutobookSchedule" WHERE "userId" = ${autobookUserId} ORDER BY "createdAt" DESC;`
    );
    let optPlan7 = parseExplainPlan(optExplain7);

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const start = performance.now();
        await prisma.autobookSchedule.findMany({
            where: { userId: autobookUserId },
            select: {
                id: true,
                userId: true,
                shopId: true,
                itemId: true,
                quantity: true,
                scheduledTime: true,
                isActive: true,
                lastRunDate: true,
                createdAt: true,
                shop: { select: { id: true, name: true } },
                item: { select: { id: true, name: true, price: true } }
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
        });
        const duration = performance.now() - start;
        if (i > WARMUP_RUNS) {
            rawSamples.push({
                queryName: '7. Autobook Schedule Lookup',
                stage: 'OPTIMIZED',
                iteration: i - WARMUP_RUNS,
                latencyMs: Number(duration.toFixed(2)),
                planningTimeMs: optPlan7.planningTimeMs,
                executionTimeMs: optPlan7.executionTimeMs,
                scanType: optPlan7.scanType,
                sharedHitBuffers: optPlan7.sharedHitBuffers,
                sharedReadBuffers: optPlan7.sharedReadBuffers,
                sortMethod: optPlan7.sortMethod,
                planSummary: optPlan7.fullText.split('\n')[0]
            });
        }
    }

    // =========================================================================
    // STEP 3: EXPORT RAW MEASUREMENTS TO CSV
    // =========================================================================
    console.log('\n📁 Writing raw measurements to docs/benchmark-results/query-benchmarks.csv...');
    const csvHeader = 'Query_Name,Stage,Run_Number,Latency_ms,Planning_Time_ms,Execution_Time_ms,Scan_Type,Shared_Hit_Buffers,Shared_Read_Buffers,Sort_Method,Plan_Summary\n';
    const csvRows = rawSamples.map(s =>
        `"${s.queryName}","${s.stage}",${s.iteration},${s.latencyMs},${s.planningTimeMs},${s.executionTimeMs},"${s.scanType}",${s.sharedHitBuffers},${s.sharedReadBuffers},"${s.sortMethod}","${s.planSummary.replace(/"/g, '""')}"`
    ).join('\n');

    const csvContent = csvHeader + csvRows;

    const targetPaths = [
        path.resolve(process.cwd(), '../docs/benchmark-results/query-benchmarks.csv'),
        path.resolve(process.cwd(), '../../docs/benchmark-results/query-benchmarks.csv'),
        path.resolve(process.cwd(), 'docs/benchmark-results/query-benchmarks.csv')
    ];

    for (const p of targetPaths) {
        try {
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, csvContent, 'utf-8');
            console.log(`   ✅ Saved CSV to: ${p}`);
        } catch { }
    }

    // =========================================================================
    // STEP 4: COMPUTE & RENDER STATISTICAL SUMMARY TABLE
    // =========================================================================
    const uniqueQueryNames = Array.from(new Set(rawSamples.map(s => s.queryName)));
    const summaries: BenchmarkSummary[] = [];

    for (const qName of uniqueQueryNames) {
        const baseRuns = rawSamples.filter(s => s.queryName === qName && s.stage === 'BASELINE');
        const optRuns = rawSamples.filter(s => s.queryName === qName && s.stage === 'OPTIMIZED');

        const baseLatencies = baseRuns.map(r => r.latencyMs);
        const optLatencies = optRuns.map(r => r.latencyMs);

        const baseMedian = getPercentile(baseLatencies, 50);
        const baseP95 = getPercentile(baseLatencies, 95);
        const optMedian = getPercentile(optLatencies, 50);
        const optP95 = getPercentile(optLatencies, 95);

        const baseBuf = baseRuns[0]?.sharedHitBuffers || 0;
        const optBuf = optRuns[0]?.sharedHitBuffers || 0;
        const speedup = optMedian > 0 ? Number((baseMedian / optMedian).toFixed(2)) : 1.0;
        const bufReduction = baseBuf > 0 ? Number((((baseBuf - optBuf) / baseBuf) * 100).toFixed(1)) : 0;

        summaries.push({
            queryName: qName,
            baselineMedianMs: baseMedian,
            baselineP95Ms: baseP95,
            baselineBuffers: baseBuf,
            baselineScan: `${baseRuns[0]?.scanType || 'Index'} (${baseRuns[0]?.sortMethod || 'None'})`,
            optimizedMedianMs: optMedian,
            optimizedP95Ms: optP95,
            optimizedBuffers: optBuf,
            optimizedScan: `${optRuns[0]?.scanType || 'Index'} (${optRuns[0]?.sortMethod || 'None'})`,
            speedup,
            bufferReductionPercent: bufReduction
        });
    }

    console.log('\n===================================================================================================================');
    console.log('🏁 PERFORMANCE BENCHMARK RESULTS: BASELINE vs OPTIMIZED');
    console.log('===================================================================================================================');
    console.table(summaries.map(s => ({
        'Representative Query': s.queryName,
        'Base Med (ms)': `${s.baselineMedianMs} ms`,
        'Base p95 (ms)': `${s.baselineP95Ms} ms`,
        'Base Scan / Sort': s.baselineScan,
        'Opt Med (ms)': `${s.optimizedMedianMs} ms`,
        'Opt p95 (ms)': `${s.optimizedP95Ms} ms`,
        'Opt Scan / Sort': s.optimizedScan,
        'Speedup': `${s.speedup}x`,
        'Buffer Reduction': `${s.bufferReductionPercent}%`
    })));
    console.log('===================================================================================================================\n');

    console.log('Extracts from PostgreSQL EXPLAIN (ANALYZE, BUFFERS):');
    console.log('1. Customer Order History:');
    console.log(`   Baseline Plan:  ${plan1.fullText.split('\n').slice(0, 4).join('\n   ')}`);
    console.log(`   Optimized Plan: ${optPlan1.fullText.split('\n').slice(0, 4).join('\n   ')}`);
    console.log('2. Staff Active Queue:');
    console.log(`   Baseline Plan:  ${plan2.fullText.split('\n').slice(0, 4).join('\n   ')}`);
    console.log(`   Optimized Plan: ${optPlan2.fullText.split('\n').slice(0, 4).join('\n   ')}`);
    console.log('5. Admin Overview Summary:');
    console.log(`   Baseline: Loaded ${rawSamples.find(s => s.queryName === '5. Admin Overview Summary' && s.stage === 'BASELINE')?.planSummary}`);
    console.log(`   Optimized: DB aggregate + groupBy in PostgreSQL (Execution time: ${optPlan5.executionTimeMs} ms, Buffers: ${optPlan5.sharedHitBuffers})`);
}

main().catch(err => {
    console.error('Benchmark execution error:', err);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
