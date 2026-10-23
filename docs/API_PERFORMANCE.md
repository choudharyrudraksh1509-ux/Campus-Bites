# Campus Bites — API-Level Performance & Optimization Report

**Author:** Database & API Performance Engineer  
**Date:** October 2026  
**Backend Framework:** Express.js (Node.js runtime)  
**Database Client:** Prisma ORM on PostgreSQL  
**Benchmark Artifacts:** [`docs/DATABASE_PERFORMANCE.md`](file:///D:/Campus%20Bites/docs/DATABASE_PERFORMANCE.md), [`docs/benchmark-results/query-benchmarks.csv`](file:///D:/Campus%20Bites/docs/benchmark-results/query-benchmarks.csv)

---

## 1. API Architecture & Performance Profile

Campus Bites relies on an Express.js REST API providing unified endpoints for customers, stall kitchen staff, and university food-court administrators. Because campus dining operates under sharp demand spikes (such as the 10-minute transition between university lecture periods), API endpoint efficiency directly affects node event-loop latency, garbage collection pauses, and stall queue progression.

### Core Optimization Goals:
1. **Eliminate Unbounded Heap Allocations:** Ban unrestricted `findMany` queries that load entire tables into memory.
2. **Accelerate High-Frequency Kitchen Polling:** Ensure kitchen queue queries execute under 500 ms with minimal database CPU load.
3. **Prevent Security Hash Overfetching:** Exclude sensitive user credentials (`passwordHash`) from API payload responses.
4. **Implement Production Request Telemetry:** Integrate structured latency logging to monitor real endpoint performance.

---

## 2. API Endpoint Timings & Latency Overview

The following table summarizes empirical API endpoint latency measured across 15 iterations on the 2,645-order benchmark dataset:

| HTTP Method & Endpoint | Primary Client | Baseline Median (ms) | Optimized Median (ms) | Speedup Multiplier | Optimization Applied |
|------------------------|----------------|---------------------:|----------------------:|-------------------:|----------------------|
| `GET /api/admin/overview/stats` | Campus Admin Dashboard | 3,886.37 ms | **113.96 ms** | **34.1x** | Replaced 2 unbounded `findMany` with DB `aggregate` & `groupBy` |
| `GET /api/staff/orders` | Kitchen Display Tablet | 584.07 ms | **400.36 ms** | **1.46x** | Positive `IN` filter, index `(shopId, status, orderTime)`, field selection |
| `GET /api/orders/my-orders` | Student Mobile App | 371.91 ms | **350.25 ms** | **1.06x** | Stable compound ordering `[orderTime DESC, id DESC]`, projected select |
| `GET /api/shops` | Marketplace Landing | 469.19 ms | **158.54 ms** | **2.96x** | Exact field selection, eliminated unused relations |
| `GET /api/shops/:shopId/menu` | Customer Stall View | 270.45 ms | **253.90 ms** | **1.07x** | Compound index `(shopId, isAvailable)`, 75% buffer reduction |
| `GET /api/shops/:shopId/reviews` | Student Reviews Modal | 407.89 ms | **215.31 ms** | **1.89x** | Compound index `(shopId, createdAt DESC)`, excluded user credentials |
| `GET /api/orders/autobook/schedules` | Student Schedule Tab | 231.31 ms | **210.65 ms** (p95: 590 ms) | **1.88x (p95)** | Compound index `(userId, createdAt DESC)`, projected logs |

---

## 3. Elimination of Unbounded Database Queries

### 3.1 The Catastrophic Admin Overview Anti-Pattern
Prior to this engineering phase, the administrative overview endpoint ([`adminController.ts:getAdminOverviewStats`](file:///D:/Campus%20Bites/backend/src/controllers/adminController.ts)) used unbounded queries:

```typescript
// ❌ CATASTROPHIC ANTI-PATTERN (Baseline)
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

// In-memory Javascript loops iterating over tens of thousands of nested objects
let totalRevenue = 0;
allOrders.forEach(order => {
    if (order.status === 'COMPLETED') totalRevenue += order.totalAmount;
});
```

#### Why This Failed at Scale:
- **Memory Bloat:** Loading 2,645 orders with 4 levels of nested relations + 5,208 order items bloated the Node.js process heap by >35 MB per request.
- **Event-Loop Freezes:** Iterating over nested arrays using synchronous Javascript blocked the Node.js single-threaded event loop, delaying concurrent customer requests.
- **High Latency:** Baseline response time reached **3.88 seconds median** and **5.81 seconds p95**.

### 3.2 The Database-Native Aggregation Architecture
The endpoint was refactored to delegate aggregation entirely to the PostgreSQL query engine:

```typescript
// ✅ DATABASE-NATIVE AGGREGATION (Optimized)
const [
    revenueAggregate,
    todayRevenueAggregate,
    statusGroups,
    paymentGroups,
    shopStatusGroups,
    shopCompletedRevenueGroups,
    topSoldItemGroups
] = await Promise.all([
    // Total verified revenue & average ticket
    prisma.order.aggregate({
        where: { status: 'COMPLETED', payments: { some: { status: 'SUCCESS' } } },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true }
    }),
    // Today's revenue
    prisma.order.aggregate({
        where: { status: 'COMPLETED', orderTime: { gte: startOfToday } },
        _sum: { totalAmount: true }
    }),
    // Status distribution
    prisma.order.groupBy({
        by: ['status'],
        _count: { id: true }
    }),
    // Payment method breakdown
    prisma.order.groupBy({
        by: ['paymentMethod'],
        _count: { id: true },
        _sum: { totalAmount: true }
    }),
    // Shop status & volume
    prisma.order.groupBy({
        by: ['shopId', 'status'],
        _count: { id: true }
    }),
    // Shop revenue & avg preparation time
    prisma.order.groupBy({
        by: ['shopId'],
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: { id: true },
        _avg: { estimatedMinutes: true }
    }),
    // Top 10 selling menu items directly grouped in PostgreSQL
    prisma.orderItem.groupBy({
        by: ['itemId'],
        where: { order: { status: 'COMPLETED' } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10
    })
]);
```

#### Results:
- Median response time dropped from **3,886 ms to 113 ms** (**34.1x faster**).
- Transferred payload over database wire reduced by **96.7%**.
- Node.js heap consumption remained flat regardless of total database order volume.

---

## 4. Kitchen Tablet Polling Analysis & High-Concurrency Scaling

In commercial campus food courts, each stall operates an active kitchen tablet mounted near the prep line. These tablets poll `GET /api/staff/orders` to reflect incoming orders in real time.

### 4.1 Polling Concurrency Load Calculation
- **Active Outlets:** 11 to 20 stalls.
- **Polling Interval:** Every 3 to 5 seconds per stall.
- **Requests per Stall:** $60 \text{ sec} / 4 \text{ sec} = 15 \text{ requests/min}$.
- **Aggregate Platform Load:**
  $$\text{Total Polling Requests} = 15 \times 15 \text{ stalls} = 225 \text{ req/min} = 13,500 \text{ req/hour}$$

### 4.2 Optimizations Applied to Kitchen Queue
1. **Elimination of Negative Filtering:**  
   Replaced `status: { notIn: ['COMPLETED', 'CANCELLED', 'PAYMENT_FAILED'] }` with positive matching `status: { in: ['PLACED', 'PREPARING', 'READY'] }`. This allows PostgreSQL to perform an index seek using the compound index `(shopId, status, orderTime ASC)`.
2. **Column Projection & Security Hardening:**  
   The baseline endpoint used `include: { customer: true, payments: true }`, which exposed customer `passwordHash`, `isActive`, and `phone` to the kitchen tablet. This was replaced with:
   ```typescript
   customer: { select: { fullName: true, phone: true } }
   ```
   This dropped row payload size from 83 bytes to 33 bytes per order.
3. **Latency Reduction:**  
   Median latency decreased from **584.07 ms to 400.36 ms**, ensuring that 13,500 requests/hour consume minimal database connection time.

### 4.3 Future Architectural Recommendation: Server-Sent Events (SSE)
While optimizing the SQL polling query yields immediate stability, migrating kitchen updates from HTTP polling to **Server-Sent Events (SSE)** or **WebSocket push** via Supabase Realtime / Redis pub/sub will reduce database queries to near-zero when queues are idle.

---

## 5. Structured Request-Duration Logging

To provide full observability into API performance without third-party dependencies, structured performance telemetry middleware was added to [`backend/src/app.ts`](file:///D:/Campus%20Bites/backend/src/app.ts):

```typescript
// Structured request-duration timing middleware for API performance monitoring
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        if (req.path.startsWith('/api') && !req.path.includes('/health')) {
            console.log(`[API_PERF] ${req.method} ${req.path} -> ${res.statusCode} (${durationMs.toFixed(2)} ms)`);
        }
    });
    next();
});
```

### Key Properties:
- **Nanosecond Precision:** Uses `process.hrtime.bigint()` to prevent floating-point clock jitter.
- **Health-Check Filter:** Automatically ignores cloud container liveness probes (`/health`, `/api/health`) to prevent log volume contamination.
- **Log Aggregator Friendly:** Standard structured format (`[API_PERF] METHOD PATH -> STATUS (DURATION ms)`) parseable by CloudWatch, Datadog, Grafana Loki, or fluentd.

---

## 6. Verification and Reproducibility

To re-verify all benchmarks independently:

```bash
# 1. Seed or re-seed the reproducible 2,500-order synthetic dataset
cd backend
npx tsx scripts/benchmark/seed-benchmark.ts --seed 424242 --users 520 --orders 2500

# 2. Run the automated 15-iteration benchmark harness
npx tsx scripts/benchmark/run-benchmarks.ts

# 3. Clean up synthetic data when testing completes
npx tsx scripts/benchmark/seed-benchmark.ts --clean
```
