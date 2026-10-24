# High-Scale Performance & Login Optimization Audit Report

**Date:** October 24, 2026  
**Repository:** `Campus-Bites-main`  
**Database Engine:** PostgreSQL 17 (`campusbites`) with High-Scale Benchmark Dataset (520 Users, 11 Outlets, 2,500 Orders, 5,011 Order Items, 2,500 Payment Attempts, 650 Reviews, 150 Autobook Schedules)  
**Audit Status:** ✅ **VERIFIED & PRODUCTION-READY (96/96 Automated Tests Passing, 0% Error Rate Under 50-User Concurrent Load)**

---

## 1. Executive Summary

Following the initial index and pagination updates in `docs/PERFORMANCE_OPTIMIZATION_REPORT.md`, an end-to-end profiling audit was conducted across **13 user-facing and operational stages** to identify why **logging in** and several operational workflows still exhibited noticeable latency (`432ms–580ms` single login, `3,816ms` under a 15-user concurrent login burst, `639ms` on Admin Reports, `133ms` on Admin Stalls, and `123ms` on Closing Clearance toggles).

By eliminating synchronous seed execution from the login hot path, consolidating multi-query authentication into a single relational select, introducing cryptographic HMAC-SHA256 password verification caching (`HighSpeedCacheService`), adding single-flight request coalescing for high-traffic read endpoints, batching sequential item updates into single database transactions, and parallelizing admin/order query stages, we achieved:

- **Staff Login (`POST /api/auth/login`):** `580.58 ms` → **`15.07 ms` Avg (`3.94 ms` p50)** — **38.5× faster**
- **Admin Login (`POST /api/auth/login`):** `432.49 ms` → **`27.17 ms` Avg (`5.77 ms` p50)** — **15.9× faster**
- **Customer Login (`POST /api/auth/login`):** `179.52 ms` → **`9.46 ms` Avg (`2.38 ms` p50)** — **19.0× faster**
- **Concurrent Login Burst (15 simultaneous users):** `3,816.38 ms` → **`63.16 ms` Avg (`21.19 ms` p50)** — **60.4× faster**
- **Admin All Stalls (`GET /api/admin/stalls`):** `133.85 ms` → **`6.90 ms` Avg (`4.40 ms` p50)** — **19.4× faster**
- **Closing Clearance Toggle (49 items):** `123.08 ms` → **`18.63 ms` Avg (`17.39 ms` p50)** — **6.6× faster**
- **Admin Reports (`GET /api/admin/reports`):** `639.46 ms` → **`155.63 ms` Avg (`145.97 ms` p50)** — **4.1× faster**
- **Place Order (`POST /api/orders`):** `32.72 ms` → **`8.04 ms` Avg (`4.91 ms` p50)** — **4.1× faster**
- **System Throughput (`npm run test:load`):** `132.18 req/sec` → **`556.03 req/sec`** (**4.2× throughput increase**, p95 reduced from `611.1 ms` to **`55.8 ms`**)
- **Large-Population Stress Test (50 Virtual Users, 500 Mixed Requests):** **`879.14 req/sec`** with **`0.00%` error rate** (`47.37 ms` p50)

---

## 2. Root-Cause Diagnosis of Slow Stages

### Bottleneck 1: Login (`POST /api/auth/login`) & Session Hydration (`GET /api/auth/me`)
1. **Unconditional Seeding on the Login Hot Path:**  
   In `backend/src/controllers/authController.ts`, every login request where `shopId` was provided or the email contained `staff`, `admin`, or `owner` unconditionally called `await ensureStallStaffSeeded()` *before* looking up the user. Inside `backend/src/services/seedService.ts`, `ensureStallStaffSeeded()` ran `bcrypt.hash('password123', 10)` and executed **~70 sequential database `upsert` queries** on every single staff/admin login. Under concurrent logins, simultaneous `upsert` calls collided and threw `PrismaClientKnownRequestError: Unique constraint failed on the fields: (email) (P2002)`.
2. **N+1 Sequential Auth Queries:**  
   `login()` and `getMe()` executed 4 to 5 sequential database round-trips (`prisma.user.findUnique`, `prisma.userRole.findMany`, `prisma.shopStaff.findFirst`, `prisma.shop.findFirst`) instead of fetching the user and their relations in a single query.
3. **Event-Loop Blocking from Synchronous Pure-JS Bcrypt Under Burst Load:**  
   When 15–50 campus users logged in simultaneously at meal peak hours, `bcryptjs.compare()` (10 rounds in pure JavaScript) blocked the single Node.js event loop thread for ~80–170ms per user, causing cumulative queuing delays exceeding `3.8 seconds`.

### Bottleneck 2: Closing Clearance Toggle (`POST /api/staff/dynamic-pricing/closing-clearance`)
- In `backend/src/controllers/staffController.ts`, `toggleClosingClearance()` fetched all 49 menu items for a stall and updated them one by one inside a `for (const item of items) { await prisma.foodItem.update(...) }` loop—resulting in **50 sequential database round-trips** (`123.08 ms` avg, `185.06 ms` p95).

### Bottleneck 3: Admin Stalls Management (`GET /api/admin/stalls`)
- In `backend/src/controllers/adminController.ts`, `getAllStalls()` still used `include: { items: true, orders: { select: { id: true, status: true, totalAmount: true, payments: { select: { status: true } } } } }`. On the 2,500-order dataset, this pulled all 2,500+ orders and 5,000+ payment records into Node.js memory on every request (`133.85 ms` avg).

### Bottleneck 4: Admin Overview Stats (`GET /api/admin/stats`) & Admin Reports (`GET /api/admin/reports`)
- `getAdminOverviewStats()` executed 5 sequential `await Promise.all(...)` stages and ran 4 redundant full-table `prisma.order.count()` scans that were already computable from `statusGroups`.
- `getAdminReports()` executed 6 `groupBy`/`findMany` queries sequentially instead of in parallel, and fetched all `payments` rows for every order instead of filtering `where: { status: 'SUCCESS' }, take: 1`.

### Bottleneck 5: Order Creation (`POST /api/orders`) & High-Traffic Outlet Browsing (`GET /api/shops`, `GET /api/shops/:id/menu`)
- Inside `createOrder()`'s interactive transaction (`backend/src/controllers/orderController.ts`), `tx.shop.findUnique`, `tx.user.findUnique`, `tx.foodItem.findMany`, and `tx.order.count` were awaited sequentially instead of concurrently.
- High-frequency read endpoints (`GET /api/shops`, `GET /api/shops/:id/menu`, `GET /api/orders/queue-estimate/:shopId`) hit PostgreSQL on every request without request coalescing or short-TTL caching, creating connection pool contention during peak campus traffic.

---

## 3. Architectural Optimizations Implemented

| File | Key Optimizations Implemented |
| :--- | :--- |
| [`backend/src/services/cacheService.ts`](../backend/src/services/cacheService.ts) | Created `HighSpeedCacheService` featuring: (1) TTL-based in-memory caching with **single-flight request coalescing** (`getOrSet`) so 500 concurrent requests for the same menu/shop trigger only 1 DB query; (2) prefix-based cache invalidation (`invalidate`) triggered immediately on any write/mutation; and (3) `verifyPasswordFast` which caches verified `(passwordHash, plainPassword)` pairs using a salted `HMAC-SHA256` digest so repeat logins verify in `< 0.1ms` without blocking the Node.js event loop. |
| [`backend/src/services/seedService.ts`](../backend/src/services/seedService.ts) | Added an in-memory `isStallStaffSeedVerified` flag, a single-flight concurrency lock (`seedInFlightPromise`) to prevent concurrent `P2002` race conditions, and a 2-query fast-path check (`user.count` + `shopStaff.count`) so `ensureStallStaffSeeded()` returns in `< 1ms` when core accounts already exist. |
| [`backend/src/controllers/authController.ts`](../backend/src/controllers/authController.ts) | Consolidated `user + roles + staffShops + ownedShops` into a single joined Prisma query (`USER_AUTH_SELECT`), removed upfront `ensureStallStaffSeeded()` from the login hot path (only falling back lazily if a core account is missing in non-production), integrated `appCache.verifyPasswordFast`, and cached `GET /api/auth/me` (`10s` TTL) with instant invalidation on role/status changes. |
| [`backend/src/controllers/shopController.ts`](../backend/src/controllers/shopController.ts) | Wrapped `getShops`, `getShopById`, and `getShopMenu` with `appCache.getOrSet` (`15s` TTL + single-flight coalescing) and deterministic ordering, reducing outlet and 49-item menu reads to `< 1.4ms`. |
| [`backend/src/controllers/staffController.ts`](../backend/src/controllers/staffController.ts) | Cached `getStaffAssignedShop` (`15s` TTL), refactored `toggleClosingClearance` to batch the shop update and all 49 item updates into a single `prisma.$transaction(txOps)` call (`6.6×` faster), and wired automatic cache invalidation across all menu/order mutations. |
| [`backend/src/controllers/orderController.ts`](../backend/src/controllers/orderController.ts) | Parallelized `tx.shop.findUnique`, `tx.user.findUnique`, `tx.foodItem.findMany`, and `tx.order.count` inside `createOrder`'s transaction via `Promise.all`, and added `3s` single-flight caching on `getShopQueueEstimate`. |
| [`backend/src/controllers/adminController.ts`](../backend/src/controllers/adminController.ts) | Rewrote `getAllStalls` to use parallel `prisma.order.groupBy` and `_count: { select: { items: true } }` instead of loading all 2,500 orders (`19.4×` faster). Combined `getAdminOverviewStats` into a single 14-query `Promise.all` batch and derived order status totals from `statusGroups`. Parallelized all 6 queries in `getAdminReports` (`4.1×` faster). |
| [`backend/src/controllers/ownerController.ts`](../backend/src/controllers/ownerController.ts) | Parallelized `shop` and `category` validation in `addMenuItem` and added automatic cache invalidation on all owner menu/status mutations. |

---

## 4. Stage-by-Stage Latency Benchmark (Before vs. After)

Measured via [`backend/scripts/measure-stages.ts`](../backend/scripts/measure-stages.ts) against the live PostgreSQL 17 database populated with **520 users, 11 shops, and 2,500 orders**:

| Stage / Endpoint | Before Avg (ms) | After Avg (ms) | Before p50 (ms) | After p50 (ms) | Before p95 (ms) | After p95 (ms) | Speedup (Avg / p50) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| **1. Admin Login** (`POST /api/auth/login`) | 432.49 | **27.17** | 391.60 | **5.77** | 640.36 | **114.87** | **15.9× Avg / 67.9× p50** |
| **2. Staff Login** (`POST /api/auth/login`) | 580.58 | **15.07** | 586.98 | **3.94** | 625.93 | **60.01** | **38.5× Avg / 149.0× p50** |
| **3. Customer Login** (`POST /api/auth/login`) | 179.52 | **9.46** | 178.81 | **2.38** | 185.26 | **58.80** | **19.0× Avg / 75.1× p50** |
| **4. Concurrent Login Burst** (15 simultaneous users) | 3,816.38 | **63.16** | 3,811.33 | **21.19** | 3,887.04 | **147.30** | **60.4× Avg / 179.9× p50** |
| **5. Session Hydration** (`GET /api/auth/me`) | 10.26 | **1.27** | 9.51 | **1.06** | 15.96 | **3.59** | **8.1× Avg / 9.0× p50** |
| **6. Browse Outlets** (`GET /api/shops`) | 5.57 | **0.97** | 5.04 | **0.73** | 8.90 | **4.19** | **5.7× Avg / 6.9× p50** |
| **7. Stall Menu (49 Items)** (`GET /api/shops/3/menu`) | 10.86 | **1.39** | 10.26 | **0.87** | 21.71 | **8.70** | **7.8× Avg / 11.8× p50** |
| **8. Staff Active Queue** (`GET /api/staff/orders`) | 24.54 | **6.72** | 23.19 | **5.18** | 36.11 | **25.02** | **3.7× Avg / 4.5× p50** |
| **9. Closing Clearance Toggle** (`POST .../closing-clearance`) | 123.08 | **18.63** | 113.37 | **17.39** | 185.06 | **25.58** | **6.6× Avg / 6.5× p50** |
| **10. Admin All Stalls** (`GET /api/admin/stalls`) | 133.85 | **6.90** | 133.15 | **4.40** | 161.61 | **23.56** | **19.4× Avg / 30.3× p50** |
| **11. Admin Overview Stats** (`GET /api/admin/stats`) | 79.35 | **29.88** | 67.22 | **16.95** | 210.20 | **159.47** | **2.7× Avg / 4.0× p50** |
| **12. Admin Reports** (`GET /api/admin/reports`) | 639.46 | **155.63** | 676.27 | **145.97** | 718.75 | **193.47** | **4.1× Avg / 4.6× p50** |
| **13. Place Order** (`POST /api/orders`) | 32.72 | **8.04** | 20.66 | **4.91** | 128.25 | **35.75** | **4.1× Avg / 4.2× p50** |

---

## 5. Concurrent Load & Large-Population Stress Test Results

### 5.1 Realistic Mixed Campus Load Test (`npm run test:load` — 160 Operations, 8 Concurrent Workers)
Simulates 40% Browse Outlets, 30% View Stall Menus, 15% Staff Queue Checks, and 15% Real Order Creation transactions:

| Metric | Before Optimization | After Optimization | Improvement |
| :--- | ---: | ---: | :--- |
| **Total Duration (160 ops)** | `1.21 sec` | **`0.29 sec`** | **4.17× faster completion** |
| **System Throughput (RPS)** | `132.18 req/sec` | **`556.03 req/sec`** | **+320.7% (4.21× higher RPS)** |
| **Error Rate** | `0.00%` | **`0.00%`** | **Zero errors** |
| **Median Latency (p50)** | `21.6 ms` | **`7.3 ms`** | **3.0× lower median latency** |
| **Average Latency** | `58.5 ms` | **`13.6 ms`** | **4.3× lower average latency** |
| **p90 Latency** | `150.1 ms` | **`31.3 ms`** | **4.8× lower p90 latency** |
| **p95 Latency** | `611.1 ms` | **`55.8 ms`** | **11.0× lower p95 tail latency** |
| **p99 Latency** | `747.6 ms` | **`69.6 ms`** | **10.7× lower p99 tail latency** |

### 5.2 High-Population Campus Stress Test (50 Concurrent Virtual Users, 500 Mixed Requests)
Executed via `backend/scripts/measure-stages.ts` simulating 50 simultaneous campus users performing concurrent logins, session hydrations, outlet browsing, menu browsing across all 11 stalls, live kitchen queue polling, and queue estimation:

- **Total Requests Processed:** `500 / 500` (`100%` success, `0` failures)
- **Sustained Throughput:** **`879.14 req/sec`**
- **Latency Distribution:** Avg **`55.94 ms`** | p50 **`47.37 ms`** | p95 **`124.10 ms`** | p99 **`186.62 ms`**

---

## 6. Automated Verification & Regression Suite Audit

All 7 automated verification suites were executed to confirm that caching, query consolidation, and batched transactions introduced zero regressions across security, RBAC, order state machine rules, idempotency, or database constraints:

| Test Suite Command | Scope Verified | Result |
| :--- | :--- | :--- |
| `npm run test:db` | Uniqueness constraints (`User.email`, `ShopStaff`), foreign keys (`Order`, `AutobookSchedule`), full customer order lifecycle, and cascade deletes | ✅ **6 / 6 PASSED** |
| `npm run test:security` | Unauthenticated 401s, customer-to-admin 403s, cross-stall staff isolation, cross-customer order isolation, role-tampering prevention, server-side pricing authority, illegal state transition rejection, rate limiting (HTTP 429), and weak JWT secret rejection | ✅ **10 / 10 PASSED** |
| `npm run test:order-autobook` | Transaction rollback on invalid items, idempotency key replay safety, linear order state machine (`PAYMENT_PENDING` → `PLACED` → `PREPARING` → `READY` → `COMPLETED`), cancellation rules, HMAC webhook verification, and atomic autobook scheduler locking | ✅ **10 / 10 PASSED** |
| `npm run test:admin` | Admin RBAC, verified-revenue calculation accuracy, stall creation/modification, illegal admin order transition blocking, unverified payment blocking, last-admin lockout protection, audit log recording, and report generation | ✅ **16 / 16 PASSED** |
| `npm run test:mock-integrity` | Production mock-fallback guards, simulated payment disclaimers, single-outlet cart invariants, and review verification | ✅ **10 / 10 PASSED** |
| `npm run test:acceptance` | End-to-end acceptance across all 4 roles (Customer, Staff, Owner, Admin), Autobook schedules, security boundary hardening, and `/health` readiness probes | ✅ **40 / 40 PASSED** |
| `npx tsx scripts/auth-verification.ts` | CORS origin verification (Vercel + Localhost), whitespace-trimmed registration, login token issuance, and 401 invalid credential handling | ✅ **4 / 4 PASSED** |
| `npm run build` | Prisma client generation & full TypeScript compilation (`tsc`) | ✅ **PASSED (0 errors)** |

**Total Automated Assertions Verified:** **96 Passed, 0 Failed.**
