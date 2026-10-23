# Campus Bites — Central Admin Operations Portal Documentation

## 1. Executive Summary & Architecture

The **Campus Bites Admin Operations Portal** provides platform administrators with real-time operational governance, live kitchen order monitoring across campus food courts, database-level verified financial aggregation, structured audit trails, and multi-tenant outlet management.

All admin operations are guarded by strict role-based access control (RBAC), database transaction consistency, and administrative lockout safeguards.

```
                           +---------------------------+
                           |  Frontend Admin Dashboard |
                           |   (React + TypeScript)    |
                           +-------------+-------------+
                                         |
                                         | JWT (role: 'ADMIN')
                                         v
                           +---------------------------+
                           |  Express Admin Router     |
                           |   /api/admin/*            |
                           |  [authenticateToken]      |
                           |  [requireAdmin]           |
                           +-------------+-------------+
                                         |
         +-------------------------------+-------------------------------+
         |                               |                               |
         v                               v                               v
+------------------+           +-------------------+           +------------------+
| Fast DB Metrics  |           | Structured Audit  |           | Outlet & User    |
| & Aggregations   |           | Logging Engine    |           | Governance       |
| (Prisma GroupBy) |           | (recordAuditLog)  |           | (Lockout Guard)  |
+--------+---------+           +---------+---------+           +--------+---------+
         |                               |                              |
         +-------------------------------+------------------------------+
                                         |
                                         v
                           +---------------------------+
                           |   Supabase PostgreSQL     |
                           |  (Prisma ORM Client)      |
                           +---------------------------+
```

---

## 2. Security & Access Control

### 2.1 Backend RBAC (`requireAdmin`)
All admin endpoints under `/api/admin` require:
1. `authenticateToken`: Cryptographically verifies the HS256 JWT signature using `JWT_SECRET`.
2. `requireAdmin`: Inspects `req.user.role === 'ADMIN'`. Non-admin requests (e.g., `CUSTOMER` or `STAFF`) are immediately rejected with **HTTP 403 Forbidden**. Unauthenticated requests return **HTTP 401 Unauthorized**.

### 2.2 Frontend Access Control Gate
In `frontend/src/pages/AdminDashboard.tsx`, the local authenticated user profile is validated on component initialization. If the user is unauthenticated or lacks the `ADMIN` role, an explicit **Access Restricted** screen is rendered:
- Red shield status icon and clear explanation of required clearance.
- Immediate redirect button returning to the campus home view (`/`).
- Prevents rendering internal dashboard views or dispatching unauthorized queries.

---

## 3. Database-Level Performance Aggregations

Previously, overview statistics loaded every order and order item across all time into Node.js heap memory for in-memory iteration. Under high order volume, this caused unbounded memory overhead and connection exhaustion.

`getAdminOverviewStats` now executes fast, database-level Prisma aggregations:

### 3.1 Verified Paid Revenue
Revenue is defined strictly from completed orders with verified payment records:
```typescript
const verifiedPaidFilter = {
    status: 'COMPLETED',
    payments: { some: { status: 'SUCCESS' } }
};
```

### 3.2 Parallel Aggregation Stages
To prevent exceeding database pool limits while maximizing throughput, queries are batched in structured stages:
1. **Order Counts**: `prisma.order.count()` for total, today's, active, completed, and cancelled orders.
2. **Revenue Aggregation**: `prisma.order.aggregate()` for `_sum.totalAmount` and `_avg.totalAmount`.
3. **Outlets & Catalog**: `prisma.shop.findMany()` with counts and `prisma.foodItem.count()`.
4. **Grouped Telemetry**:
   - `prisma.order.groupBy({ by: ['status'] })`
   - `prisma.order.groupBy({ by: ['paymentMethod'] })`
   - `prisma.order.groupBy({ by: ['shopId', 'status'] })`
   - `prisma.order.groupBy({ by: ['shopId'], where: verifiedPaidFilter })`
5. **Trends & Leaderboards**:
   - `prisma.orderItem.groupBy({ by: ['itemId'], where: { order: verifiedPaidFilter }, orderBy: { _sum: { quantity: 'desc' } }, take: 10 })`
   - Recent 7-day orders for daily trend calculation and today's 24-hour surge distribution.

---

## 4. Structured Audit Logging

To guarantee traceability for compliance and operational governance, every state-altering administrative action is captured in the database via the `recordAuditLog` helper.

### 4.1 Schema Definition
```prisma
model AuditLog {
  id         Int      @id @default(autoincrement())
  adminId    Int
  action     String
  entity     String
  entityId   Int?
  details    String?
  createdAt  DateTime @default(now())

  admin      User     @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@index([adminId])
  @@index([entity])
  @@index([createdAt])
}
```

### 4.2 Tracked Admin Actions
| Action | Entity | Trigger Point | Details Logged |
|---|---|---|---|
| `CREATE_STALL` | `SHOP` | `POST /api/admin/stalls` | Stall name, area, owner name |
| `UPDATE_STALL` | `SHOP` | `PATCH /api/admin/stalls/:shopId` | Changed fields (status, clearance, area) |
| `UPDATE_USER_ROLE` | `USER` | `PATCH /api/admin/users/:userId/role` | User identifier, new role, stall assignment |
| `UPDATE_USER_STATUS` | `USER` | `PATCH /api/admin/users/:userId/status` | User activation or deactivation |
| `UPDATE_ORDER_STATUS` | `ORDER` | `PATCH /api/admin/orders/:orderId/status` | Order ID, previous status, new status |
| `SEED_REALTIME_DATA` | `SYSTEM` | `POST /api/admin/seed-realtime-data` | Seeding trigger count and batch ID |

### 4.3 Audit Logs Query API (`GET /api/admin/audit-logs`)
- **Query Parameters**:
  - `page`: Page index (default: `1`)
  - `limit`: Records per page (default: `20`, max: `100`)
  - `entity`: Entity filter (`ALL`, `SHOP`, `USER`, `ORDER`, `SYSTEM`)
  - `action`: Specific action filter
  - `search`: Case-insensitive substring search in action, details, admin name, or admin email
- **Response**: `{ logs, total, page, limit, totalPages }` with included admin credentials (`fullName`, `email`).

---

## 5. Outlet Management (Stalls)

Administrators have full lifecycle control over food outlets and campus stalls:

1. **Create Outlet (`POST /api/admin/stalls`)**:
   - Required Body: `{ name: string, areaId: number, ownerId: number }`
   - Validates existence of specified `Area` and `User` (owner).
   - Initializes stall in `ACTIVE` status.
   - Automatically records `CREATE_STALL` audit log.

2. **Update Outlet Settings (`PATCH /api/admin/stalls/:shopId`)**:
   - Modifiable fields: `name`, `areaId`, `status` (`ACTIVE`/`INACTIVE`/`CLOSED`), `isClosingSoon`, `closingDiscount` (0–100%).
   - Automatically records `UPDATE_STALL` audit log.

3. **View Stall Staff (`GET /api/admin/stalls/:shopId/staff`)**:
   - Returns all staff members linked to the outlet with contact and activity status.

4. **View Stall Menu (`GET /api/admin/stalls/:shopId/menu`)**:
   - Returns all food items, categories, pricing, and availability states for the stall.

---

## 6. User Management & Admin Lockout Safeguards

### 6.1 Directory Query (`GET /api/admin/users`)
- Supports search by customer name, email, or phone number.
- Role filtering (`ALL`, `CUSTOMER`, `STAFF`, `OWNER`, `ADMIN`).
- Server-side pagination with `{ users, total, page, limit, totalPages }`.

### 6.2 Role Modification (`PATCH /api/admin/users/:userId/role`)
- Safely transitions roles between `CUSTOMER`, `STAFF`, `OWNER`, and `ADMIN`.
- Automatically synchronizes `ShopStaff` relationships when assigning staff to a stall.

### 6.3 Account Status Toggle (`PATCH /api/admin/users/:userId/status`)
- Activates or deactivates user accounts (`isActive: boolean`).

### 6.4 Single-Admin Lockout Protection (Zero-Downtime Guard)
To prevent accidental administrative lockout:
- If a target user currently holds the `ADMIN` role, and an admin attempts to:
  1. Demote their role to a non-admin role (`CUSTOMER`, `STAFF`, `OWNER`), or
  2. Deactivate the user's account (`isActive: false`),
- The system queries the database for the count of active administrators:
  ```typescript
  const activeAdminCount = await prisma.userRole.count({
      where: {
          role: { name: 'ADMIN' },
          user: { isActive: true }
      }
  });
  ```
- If `activeAdminCount <= 1`, the request is rejected with **HTTP 400 Bad Request**:
  > *"Cannot modify or demote the last remaining active administrator. At least one ADMIN must remain active."*

---

## 7. Order Management & State Machine Enforcement

Administrators can monitor live kitchen orders across all outlets and override order statuses in exceptional conditions.

### 7.1 State Machine Transition Rules
Order transitions must strictly conform to the allowed lifecycle transitions:
```typescript
const VALID_ADMIN_TRANSITIONS: Record<string, string[]> = {
    'PAYMENT_PENDING': ['PLACED', 'CANCELLED', 'PAYMENT_FAILED'],
    'PLACED':          ['PREPARING', 'READY', 'CANCELLED'],
    'PREPARING':       ['READY', 'COMPLETED', 'CANCELLED'],
    'READY':           ['COMPLETED', 'CANCELLED'],
    'COMPLETED':       [],
    'CANCELLED':       [],
    'PAYMENT_FAILED':  ['PAYMENT_PENDING', 'CANCELLED']
};
```
Illegal transitions (such as jumping from `PLACED` directly to `COMPLETED` or modifying terminal states) are rejected with **HTTP 400**.

### 7.2 Payment Verification Enforcement
Changing status to `PLACED`, `PREPARING`, `READY`, or `COMPLETED` requires a confirmed successful payment attempt:
- Transitioning an unpaid order (`PAYMENT_PENDING` or `PAYMENT_FAILED`) without an existing `PaymentAttempt` with `status: 'SUCCESS'` is strictly prohibited.
- Admin status updates cannot bypass payment gateway verification.

---

## 8. Comprehensive Reports (`GET /api/admin/reports`)

Provides flexible time-window filtering (`startDate`, `endDate`, `shopId`):
1. **Orders Per Day**: Total volume, completed meals, cancellations, and verified revenue per calendar day.
2. **Outlet Performance Ranking**: Breakdown of orders, completed counts, cancellation rates, and realized revenue per outlet.
3. **Status Distribution**: Percentage distribution of orders across lifecycle states.
4. **Verified Revenue Over Time**: Chronological trend of realized funds.
5. **Cancellation Metrics**: Overall cancellation rate and failure trends.

---

## 9. Admin Acceptance-Test Checklist

| Test Item | Verification Description | Expected Result | Automated Test Status |
|---|---|---|---|
| **1. Customer Rejection** | Customer JWT accesses `/api/admin/stats` | HTTP 403 Forbidden | ✅ Passed |
| **2. Unauthenticated Rejection** | Request without token accesses `/api/admin/stats` | HTTP 401 Unauthorized | ✅ Passed |
| **3. Aggregation Real Data** | `/api/admin/stats` returns metrics from database | HTTP 200 with verified revenue, 24h peak distribution, 7d trend | ✅ Passed |
| **4. Outlet Creation** | `POST /api/admin/stalls` with name, areaId, ownerId | HTTP 201 Created + `CREATE_STALL` audit log written | ✅ Passed |
| **5. Outlet Update** | `PATCH /api/admin/stalls/:id` with status & clearance | HTTP 200 OK + `UPDATE_STALL` audit log written | ✅ Passed |
| **6. Stall Staff & Menu** | `GET /api/admin/stalls/:id/staff` and `/menu` | HTTP 200 OK with valid arrays | ✅ Passed |
| **7. User Directory** | `GET /api/admin/users?role=CUSTOMER&page=1&limit=5` | HTTP 200 OK with pagination metadata `{ users, total, page, totalPages }` | ✅ Passed |
| **8. Admin Lockout Guard** | Attempt to demote/deactivate the sole active ADMIN | HTTP 400 Bad Request rejection with descriptive warning | ✅ Passed |
| **9. State Machine & Payment** | Advance unpaid `PAYMENT_PENDING` order without payment | HTTP 400 Bad Request rejection | ✅ Passed |
| **10. Audit Logs Query** | `GET /api/admin/audit-logs?page=1&limit=10` | HTTP 200 OK with structured records and admin info | ✅ Passed |
| **11. Comprehensive Reports** | `GET /api/admin/reports` with time-range aggregations | HTTP 200 OK with orders per day, outlet metrics, verified revenue | ✅ Passed |

### Running Automated Test Suite:
```bash
cd backend
npx tsx scripts/admin-tests.ts
```

All 11 automated verification tests pass cleanly.
