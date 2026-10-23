# Campus Bites - Staging Verification & Quality Gate Checklist

This document records the comprehensive staging environment validation checklists, operational verification criteria, and observed pass/fail statuses prior to production release.

---

## 1. Staging Quality Gate Summary

All staging verification tests were conducted against the staging application and cloud database instance on **October 23, 2026**.

| Verification Category | Total Checks | Passed | Failed | Overall Status |
| :--- | :---: | :---: | :---: | :---: |
| **1. Environment & Secrets** | 6 | 6 | 0 | ✅ **PASS** |
| **2. Database & Migrations** | 7 | 7 | 0 | ✅ **PASS** |
| **3. Health & Infrastructure Probes** | 3 | 3 | 0 | ✅ **PASS** |
| **4. Authentication & Access Control** | 6 | 6 | 0 | ✅ **PASS** |
| **5. Order Lifecycle & State Machine** | 8 | 8 | 0 | ✅ **PASS** |
| **6. Owner & Stall Management** | 5 | 5 | 0 | ✅ **PASS** |
| **7. Admin Dashboard & Audit Logging** | 5 | 5 | 0 | ✅ **PASS** |
| **8. Autobook Recurring Scheduler** | 4 | 4 | 0 | ✅ **PASS** |
| **9. Rate Limiting & DoS Hardening** | 4 | 4 | 0 | ✅ **PASS** |
| **TOTAL** | **48** | **48** | **0** | ✅ **100% PASS** |

---

## 2. Detailed Verification Checklist

### Category 1: Environment & Secrets Configuration
- [x] **ENV-01**: `NODE_ENV` properly configured (`test` / `staging`).
- [x] **ENV-02**: `JWT_SECRET` meets minimum length requirements (≥ 32 chars).
- [x] **ENV-03**: `DATABASE_URL` contains explicit connection limit (`connection_limit=7`).
- [x] **ENV-04**: `DIRECT_URL` provided for unpooled migrations.
- [x] **ENV-05**: Zod schema in `config/env.ts` fails safely if required variables are omitted.
- [x] **ENV-06**: Zero hardcoded secrets present in client bundle (`npm run build` verified).

### Category 2: Database Schema & Migrations
- [x] **DB-01**: `npx prisma migrate status` reports database schema in complete sync.
- [x] **DB-02**: All 11 models (`User`, `Role`, `UserRole`, `Area`, `Shop`, `ShopStaff`, `Category`, `FoodItem`, `Order`, `OrderItem`, `PaymentAttempt`, `Review`, `AutobookSchedule`, `AuditLog`, `AutobookExecutionLog`) mapped correctly.
- [x] **DB-03**: User email uniqueness constraint enforced.
- [x] **DB-04**: ShopStaff compound uniqueness (`shopId + staffId`) enforced.
- [x] **DB-05**: Foreign key constraints prevent orphaned records.
- [x] **DB-06**: Cascade delete properly cleans up child order items and payment attempts.
- [x] **DB-07**: `scripts/verify-db.ts` passes 6/6 tests.

### Category 3: Health & Infrastructure Probes
- [x] **HLT-01**: `GET /health` returns HTTP `200` with `{ status: "ok", timestamp: ... }`.
- [x] **HLT-02**: `GET /health/live` returns HTTP `200` with `{ status: "ok" }`.
- [x] **HLT-03**: `GET /health/ready` verifies live DB connection (`SELECT 1`) returning HTTP `200` with `{ status: "ok", database: "connected" }`.

### Category 4: Authentication & Access Control
- [x] **AUT-01**: User registration restricts public self-signup strictly to `CUSTOMER` role.
- [x] **AUT-02**: User login with valid credentials returns signed JWT containing `userId` and `role`.
- [x] **AUT-03**: Missing Bearer token on protected endpoints returns HTTP `401 Unauthorized`.
- [x] **AUT-04**: Expired or forged JWT returns HTTP `403 Forbidden`.
- [x] **AUT-05**: Role-based access control blocks `CUSTOMER` from `/api/admin/*` and `/api/staff/*`.
- [x] **AUT-06**: Password hashing uses bcrypt with 10 salt rounds.

### Category 5: Order Lifecycle & State Machine
- [x] **ORD-01**: Authoritative pricing computes totals purely from DB prices (client price tampering ignored).
- [x] **ORD-02**: Quantity limits enforced (1 to 50 items).
- [x] **ORD-03**: Payment confirmation advances status from `PAYMENT_PENDING` to `PLACED`.
- [x] **ORD-04**: State machine strictly enforces allowed transitions:
  - `PLACED` -> `PREPARING`
  - `PREPARING` -> `READY`
  - `READY` -> `COMPLETED`
- [x] **ORD-05**: Illegal jumps (e.g. `PLACED` -> `COMPLETED`) rejected with HTTP `400`.
- [x] **ORD-06**: Customer cancellation allowed only on unfulfilled orders (`PLACED` / `PAYMENT_PENDING`).
- [x] **ORD-07**: Review submission permitted only on `COMPLETED` orders.
- [x] **ORD-08**: Customer isolation prevents Customer B from viewing or modifying Customer A's orders.

### Category 6: Owner & Stall Management
- [x] **OWN-01**: Stall owner can query owned stall via `/api/owner/shop`.
- [x] **OWN-02**: Owner can toggle operational status (`ACTIVE` <-> `BUSY` <-> `CLOSED`).
- [x] **OWN-03**: Owner can create, price-update, and soft-delete menu items.
- [x] **OWN-04**: Unauthorized owners cannot modify items belonging to another stall.
- [x] **OWN-05**: Sales revenue reports accurately scoped to owner's assigned stall.

### Category 7: Admin Dashboard & Audit Logging
- [x] **ADM-01**: Platform admin can query aggregated platform KPIs via `/api/admin/stats`.
- [x] **ADM-02**: Admin can modify stall configurations and closing clearance discounts.
- [x] **ADM-03**: Admin stall updates automatically write immutable records to `AuditLog`.
- [x] **ADM-04**: Admin can inspect system audit logs via `/api/admin/audit-logs`.
- [x] **ADM-05**: User role promotions / demotions logged with previous and updated roles.

### Category 8: Autobook Recurring Scheduler
- [x] **ABK-01**: Customer can register daily schedule with valid 24-hr time (`HH:MM`).
- [x] **ABK-02**: Active schedule status can be toggled on/off.
- [x] **ABK-03**: Manual test trigger via `/api/orders/autobook/schedules/:id/execute` creates order.
- [x] **ABK-04**: Execution logs recorded in `AutobookExecutionLog` with status and created `orderId`.

### Category 9: Rate Limiting & DoS Hardening
- [x] **SEC-01**: Auth rate limiter throttles excessive rapid login attempts with HTTP `429`.
- [x] **SEC-02**: Request payload limiter rejects bodies > 50KB with HTTP `413`.
- [x] **SEC-03**: Helmet security headers present on all responses.
- [x] **SEC-04**: CORS rejects unauthorized browser origins with HTTP `403`.

---

## 3. Staging Sign-Off

- **Verification Date**: October 23, 2026
- **Automated Test Results**:
  - `verify-db.ts`: 6 / 6 PASSED
  - `security-tests.ts`: 10 / 10 PASSED
  - `acceptance-tests.ts`: 40 / 40 PASSED
- **Staging Gate Verdict**: ✅ **APPROVED FOR PRODUCTION RELEASE**
