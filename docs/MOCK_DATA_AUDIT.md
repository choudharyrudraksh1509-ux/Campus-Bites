# Campus Bites — Mock Data & Fallback Audit Report

**Audit Date**: October 2026  
**Auditor**: Mock Data & Data Integrity Auditor  
**Status**: Completed & Verified  

---

## 1. Executive Summary

An exhaustive audit of the entire Campus Bites codebase was conducted across frontend (`frontend/src/`) and backend (`backend/src/`) components to identify, isolate, and remediate:
- Hardcoded business data and mock API fallbacks
- Browser `localStorage` storage of critical business state
- In-memory data stores and simulated success responses
- Silent fallback cascades masking server and network failures
- Demo mode leakage into production environments

All identified issues have been systematically re-engineered to enforce **strict server-authoritative state**, explicit environment segregation, robust error/empty states, and full referential integrity.

---

## 2. Inventory of Audited Components & Remediation Matrix

| Component | Previous Fallback / Mock Behavior | Reason for Existence | Remediated Production Behavior | Dev/Demo Mode Availability | Verification Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`frontend/src/services/orderService.ts`** | If `/api/orders` failed or user lacked token, generated random `orderId`, fabricated fake order, saved to `localStorage` (`campusbite_orders`), and returned success. | Offline mock prototype and resilient demo preview. | **Removed completely.** Orders are strictly server-authoritative. Throws error on failure; unauthenticated users cannot place orders; zero fake orders in `localStorage`. | Completely removed from dev and production. | `mock-and-integrity-tests.ts` (Test 1, 2, 3, 4) |
| **`frontend/src/services/autobookService.ts`** | Maintained `localStorage` key `campusbite_autobook_schedules`. Synthesized IDs (`Math.random`), simulated toggle and delete offline. | Standalone frontend preview without backend dependency. | **Removed completely.** Directly executes CRUD against `/api/orders/autobook/schedules` backed by Prisma transactions and foreign keys. Throws on error. | Completely removed from dev and production. | `mock-and-integrity-tests.ts` (Test 15) |
| **`frontend/src/pages/Home.tsx`** | Silently fell back to `MOCK_CAMPUS_SHOPS` when `/api/shops` failed or returned empty. | Prevent blank UI if backend was not booted. | Displays explicit loading skeleton, user-facing Error State card with "Retry Connection" button, or Empty State card. Never silently masks API errors. | Only available if `import.meta.env.DEV && VITE_DEMO_MODE === 'true'`, showing prominent yellow demo banner. Strictly disabled in production. | Frontend build & manual network simulation |
| **`frontend/src/pages/Menu.tsx`** | Silently executed `loadMockData()` (`FULL_MOCK_MENUS`) when `/api/shops/:id/menu` failed or returned 0 items. | Demo preview before database menu was populated. | Displays Error State with "Retry Connection" button or Empty State ("No items in this category"). Authoritative database items and dynamic prices only. | Only available if `import.meta.env.DEV && VITE_DEMO_MODE === 'true'` with explicit warning badge. Strictly disabled in production. | Frontend build & manual network simulation |
| **`frontend/src/pages/Orders.tsx`** | Merged `localStorage` orders with backend orders. Silently pretended orders were placed offline. | Offline demo persistence. | Reads authentic customer orders from `/api/orders`. Renders real-time kitchen progress and explicit payment mode badge (`DEMO SANDBOX (ONLINE_DEMO)` vs `VERIFIED`). | Real database orders only. | `mock-and-integrity-tests.ts` (Test 7) |
| **`frontend/src/components/PaymentGatewayModal.tsx`** | Simulated credit card/UPI transactions in client component. | University prototype without live banking merchant account. | Retained as **Sandbox Demonstration Gateway**, clearly labeled with `DEMO GATEWAY` badge and records payment method as `ONLINE_DEMO`. | Clearly distinguished as sandbox in dev/demo. Real payments map to `UPI`, `CARD`, `NET_BANKING`, or `CASH`. | `mock-and-integrity-tests.ts` (Test 4) |
| **`backend/src/controllers/reviewController.ts`** | `IN_MEMORY_REVIEWS` and `MOCK_ITEM_RATINGS` merged into live reviews. If DB query failed or DB had 0 reviews, returned fake reviews (e.g. "Samyak M.", 4.8 rating). | Seeded review visuals for initial layout review. | Queries `prisma.review`. Returns HTTP 500 if DB fails. Returns `reviews: []`, `totalReviews: 0`, `averageRating: 0` if no reviews exist. Verified purchase required. | In-memory fallback allowed only if `NODE_ENV !== 'production' && DEMO_MODE === 'true'`. Strictly disabled in production. | `mock-and-integrity-tests.ts` (Test 5, 6) |
| **`backend/src/controllers/shopController.ts`** | Automatically triggered `ensureStallStaffSeeded()` if `shops.length === 0` on any read request. | Convenience for first-time developer runs. | Auto-seeding guarded by `NODE_ENV !== 'production' && AUTO_SEED === 'true'`. Production read requests never mutate or seed the database. | Guarded behind environment flags. | `mock-and-integrity-tests.ts` (Suite execution) |
| **`backend/src/services/seedService.ts`** | Static seed arrays `DEMO_STUDENTS` and `STALL_CREDENTIALS`. | Database seeding migration script. | Permissible only via explicit administrative setup (`npm run seed` or dev init). Never invoked implicitly during production HTTP request handling. | Manual migration tool only. | Database seeding tests |

---

## 3. Strict Environment Segregation & Safety Controls

### 3.1 Frontend (`frontend/src/`)
- **Environment Flags**:
  - `import.meta.env.VITE_DEMO_MODE`: Defaults to `'false'`.
  - `import.meta.env.DEV`: True only under `vite dev`.
- **Accidental Production Enablement Prevention**:
  ```ts
  const isDevDemoAllowed = Boolean(
    import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
  );
  ```
  In production bundles created via `vite build`, `import.meta.env.DEV` is statically compiled to `false`. Tree-shaking and dead-code elimination guarantee that demo fallbacks **cannot be activated in production**, even if an environment variable is misconfigured.

### 3.2 Backend (`backend/src/`)
- **Environment Schema (`config/env.ts`)**:
  - `NODE_ENV`: Enforces `'development' | 'test' | 'production'`.
  - `DEMO_MODE`: Defaults to `'false'`.
  - `AUTO_SEED`: Defaults to `'false'`.
- In `reviewController.ts`:
  ```ts
  const isDevDemoAllowed = process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE === 'true';
  ```
- In `shopController.ts`:
  ```ts
  if (process.env.NODE_ENV !== 'production' && process.env.AUTO_SEED === 'true') {
      await ensureStallStaffSeeded();
  }
  ```

---

## 4. Browser Client Storage Boundaries

| Storage Key | Type | Allowed? | Purpose |
| :--- | :--- | :--- | :--- |
| `token` | `localStorage` | **YES** | Authentication bearer token for session persistence across refreshes. |
| `campusbite_user` | `localStorage` | **YES** | Client profile cache (name, email, role) for instant UI hydration. Server re-authenticates every API request. |
| `campusbite_cart` | `localStorage` | **YES** | Local item drafting buffer (temporary cart). Server completely ignores client prices and re-evaluates prices, discounts, and inventory at checkout. |
| `campusbite_orders` | `localStorage` | **FORBIDDEN (REMOVED)** | Critical business state. Orders must solely exist in PostgreSQL via Prisma. |
| `campusbite_autobook_schedules` | `localStorage` | **FORBIDDEN (REMOVED)** | Recurring order schedules must solely exist in PostgreSQL via `AutobookSchedule`. |

---

## 5. Verification Test Suite Output

Automated test suite `backend/scripts/mock-and-integrity-tests.ts` was executed to verify all mock and data integrity protections:

```
================================================================
🧪 RUNNING MOCK DATA REJECTION & DATABASE INTEGRITY SUITE
================================================================

--- PART 1: MOCK DATA & SIMULATED FALLBACK REJECTION ---
  ✅ PASS: Unauthenticated order request is rejected with 401 (no fake order created)
  ✅ PASS: Non-existent item ID in order payload is rejected without fabricating order
  ✅ PASS: Cross-stall item mixing is rejected and does not silently proceed
  ✅ PASS: Client-tampered prices are ignored; server authoritative DB price is enforced
  ✅ PASS: Submitting review without a completed order returns 403 and does not inject fake review
  ✅ PASS: Shop reviews endpoint returns real data and never injects in-memory mock reviews
  ✅ PASS: Customer B cannot cancel Customer A order (ownership enforcement)

--- PART 2: DATABASE INTEGRITY & CONSTRAINTS ---
  ✅ PASS: User email uniqueness constraint is enforced (Prisma P2002)
  ✅ PASS: ShopStaff compound uniqueness [shopId, staffId] prevents duplicates
  ✅ PASS: Review orderId uniqueness enforces strictly one review per order
  ✅ PASS: Foreign key constraint rejects Order with non-existent customerId
  ✅ PASS: Foreign key constraint rejects Order with non-existent shopId
  ✅ PASS: Cascade deletion removes OrderItem and PaymentAttempt on Order deletion without deleting Shop or Customer
  ✅ PASS: Monetary precision: Order preserves snapshot price even if menu item price changes
  ✅ PASS: AutobookSchedule foreign key enforces valid User, Shop, and FoodItem

================================================================
🏁 TEST RESULTS: 15 PASSED | 0 FAILED
================================================================
```
