# Campus Bites - Test Accounts, Roles & Fixtures Directory

This document details the test account credentials, role assignments, pre-seeded fixtures, and database teardown procedures used for quality assurance, acceptance testing, and load simulation.

---

## 1. Test Accounts Directory

All automated test suites (`test:security`, `test:acceptance`, `test:load`) authenticate using dedicated test accounts with deterministic passwords:

| Role | Email Address | Default Password | Assigned Stall / Scope | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`CUSTOMER`** | `uat.customer@campusbites.test` | `Password123!` | None (Campus Student) | Testing order placement, menu browsing, order tracking, reviews, and autobook schedules. |
| **`STAFF`** | `uat.staff@campusbites.test` | `Password123!` | *UAT Acceptance Stall* | Testing live kitchen queue, order status transitions (`PREPARING` -> `READY` -> `COMPLETED`). |
| **`OWNER`** | `uat.owner@campusbites.test` | `Password123!` | *UAT Acceptance Stall* | Testing stall profile management, operational toggles (`BUSY`/`ACTIVE`), and menu CRUD. |
| **`ADMIN`** | `uat.admin@campusbites.test` | `Password123!` | Global Platform Scope | Testing platform overview metrics, stall clearance configuration, and audit log tracking. |

### Secondary Security Test Accounts
Used by `scripts/security-tests.ts` to test cross-tenant isolation and unauthorized order access:
- `customerA.test@campusbites.test` (Owner of Order A)
- `customerB.test@campusbites.test` (Adversary attempting to cancel/view Order A)

---

## 2. Test Stalls & Menu Fixtures

| Entity | ID / Name | Category | Base Price | Status | Description |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Test Area** | `Main Campus Food Court` | - | - | ACTIVE | Central dining courtyard. |
| **Test Stall** | `UAT Acceptance Stall` | - | - | ACTIVE | Assigned outlet for staff and owner test scenarios. |
| **Food Item A** | `UAT Masala Chai` | Beverages | ₹25.00 | In Stock | Test item for cart calculations and price tampering tests. |
| **Food Item B** | `UAT Samosa Plate` | Snacks | ₹40.00 | In Stock | Test item for kitchen queue processing. |
| **Seasonal Item** | `UAT Mango Lassi` | Beverages | ₹55.00 | In Stock | Ephemeral item created and deleted by Owner journey tests. |

---

## 3. Fixture Initialization & Idempotency

The test suite ensures that running tests repeatedly against the same database does not fail or duplicate accounts:

```typescript
// Roles are upserted to guarantee existence
const customerRole = await prisma.role.upsert({
    where: { name: 'CUSTOMER' },
    update: {},
    create: { name: 'CUSTOMER' }
});

// Users are fetched if existing, or created with bcrypt password hash
let customerUser = await prisma.user.findFirst({ where: { email: 'uat.customer@campusbites.test' } });
if (!customerUser) {
    customerUser = await prisma.user.create({
        data: {
            fullName: 'UAT Customer Student',
            email: 'uat.customer@campusbites.test',
            passwordHash,
            roles: { create: { roleId: customerRole.id } }
        }
    });
}
```

---

## 4. Teardown & Cleanup Protocol

All test suites register an explicit `finally` block ensuring that any orders, reviews, payment attempts, and autobook schedules generated during the test run are pruned immediately:

```typescript
// Teardown in reverse dependency order:
await prisma.review.deleteMany({ where: { orderId: { in: createdOrders } } });
await prisma.autobookExecutionLog.deleteMany({ where: { orderId: { in: createdOrders } } });
await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrders } } });
await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: createdOrders } } });
await prisma.order.deleteMany({ where: { id: { in: createdOrders } } });

await prisma.autobookExecutionLog.deleteMany({ where: { scheduleId: { in: createdSchedules } } });
await prisma.autobookSchedule.deleteMany({ where: { id: { in: createdSchedules } } });

if (createdItemIds.length > 0) {
    await prisma.foodItem.deleteMany({ where: { id: { in: createdItemIds } } });
}
```

This ensures zero test data pollution in production analytics, stall revenue KPIs, or live student feeds.
