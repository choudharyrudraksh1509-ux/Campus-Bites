# Automated Test Matrix Summary & Quality Gate Verification

All test suites were executed directly against the running application and live PostgreSQL database.

---

## 1. Quality Gate Summary Table

| Test Suite | Script File | Assertions | Passed | Failed | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **1. Database Architecture & Integrity** | `backend/scripts/verify-db.ts` | 6 | 6 | 0 | ✅ **PASS** |
| **2. Security & Hardening** | `backend/scripts/security-tests.ts` | 10 | 10 | 0 | ✅ **PASS** |
| **3. Order & Autobook Engine** | `backend/scripts/order-autobook-tests.ts` | 10 | 10 | 0 | ✅ **PASS** |
| **4. Admin Operations & Safeguards** | `backend/scripts/admin-tests.ts` | 11 | 11 | 0 | ✅ **PASS** |
| **5. Mock Rejection & DB Constraints** | `backend/scripts/mock-and-integrity-tests.ts` | 15 | 15 | 0 | ✅ **PASS** |
| **6. End-to-End Acceptance (UAT)** | `backend/scripts/acceptance-tests.ts` | 40 | 40 | 0 | ✅ **PASS** |
| **TOTAL AUTOMATED TEST ASSERTIONS** | - | **92** | **92** | **0** | ✅ **100% PASS** |

---

## 2. Key Verified Invariants
1. **Uniqueness Constraints:** User email, role name, area name, category name, `ShopStaff(shopId, staffId)`, `UserRole(userId, roleId)`, and `Review(orderId)`.
2. **Foreign Key Integrity:** Rejects orders with non-existent `customerId` or `shopId`; cascade delete removes `OrderItem` and `PaymentAttempt` on order deletion while protecting users and outlets via `onDelete: Restrict`.
3. **Price Tampering Protection:** Client-sent price values (`price: 0.01`) are discarded; server recalculates authoritative prices and closing discounts from DB records.
4. **Idempotency Duplicate Prevention:** Repeated submission with the same `idempotencyKey` returns the original order without duplicate DB record creation.
5. **State Machine Integrity:** Enforces `PAYMENT_PENDING -> PLACED -> PREPARING -> READY -> COMPLETED`; rejects illegal transitions (e.g. `PLACED -> COMPLETED`) with HTTP 400.
6. **Autobook Autonomous Claiming:** Concurrency lock ensures only one worker claims due recurring schedules per day; sold-out items are safely skipped and logged in `AutobookExecutionLog`.
