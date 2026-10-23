# Database Schema & Models Overview

## 1. Runtime Database Engine & Connector
- **Runtime Database:** PostgreSQL 15.8 (Hosted on Supabase, AWS Region `ap-southeast-1` Singapore)
- **Runtime ORM / Query Builder:** Prisma Client `v5.22.0`
- **Driver:** PostgreSQL wire protocol via native TCP client
- **Primary Schema Definition:** `backend/prisma/schema.prisma`
- **Active Migrations Tracked:** `backend/prisma/migrations/`

---

## 2. Table & Model Inventory

| Model / Table | Primary Key | Total Columns | Foreign Key Relations | Runtime Purpose |
| :--- | :--- | :---: | :--- | :--- |
| **`User`** | `id` (Int, Auto-inc) | 6 | `roles`, `ownedShops`, `staffShops`, `orders`, `reviews`, `autobooks`, `auditLogs` | Core identity ledger for Customers, Staff, Owners, and Admins. |
| **`Role`** | `id` (Int, Auto-inc) | 2 | `users` (via `UserRole`) | RBAC role definitions (`CUSTOMER`, `STAFF`, `OWNER`, `ADMIN`). |
| **`UserRole`** | `id` (Int, Auto-inc) | 3 | `userId` -> `User.id`, `roleId` -> `Role.id` | Junction table mapping users to roles. Unique constraint `[userId, roleId]`. |
| **`Area`** | `id` (Int, Auto-inc) | 3 | `shops` | Campus food court zones and physical buildings. Unique on `name`. |
| **`Shop`** | `id` (Int, Auto-inc) | 7 | `ownerId` -> `User.id`, `areaId` -> `Area.id` | Outlet registry with operational status (`ACTIVE`/`INACTIVE`) and clearance toggles. |
| **`ShopStaff`** | `id` (Int, Auto-inc) | 3 | `shopId` -> `Shop.id`, `staffId` -> `User.id` | Multi-tenant staff assignment. Unique compound constraint `[shopId, staffId]`. |
| **`Category`** | `id` (Int, Auto-inc) | 2 | `items` | Food categories (e.g. Beverages, Snacks, Meals). Unique on `name`. |
| **`FoodItem`** | `id` (Int, Auto-inc) | 10 | `shopId` -> `Shop.id`, `categoryId` -> `Category.id` | Menu items catalog, base prices, discounts, and availability toggles. |
| **`Order`** | `id` (Int, Auto-inc) | 11 | `customerId` -> `User.id`, `shopId` -> `Shop.id` | Order fulfillment ledger, token queue, total price, and idempotency key. |
| **`OrderItem`** | `id` (Int, Auto-inc) | 5 | `orderId` -> `Order.id`, `itemId` -> `FoodItem.id` | Order item snapshot. Preserves immutable `priceAtOrder`. |
| **`PaymentAttempt`** | `id` (Int, Auto-inc) | 5 | `orderId` -> `Order.id` | Financial transaction attempts decoupled from order fulfillment. |
| **`Review`** | `id` (Int, Auto-inc) | 6 | `orderId` -> `Order.id`, `customerId` -> `User.id`, `shopId` -> `Shop.id` | Customer feedback. Unique on `orderId` (enforces 1 review per purchase). |
| **`AutobookSchedule`**| `id` (Int, Auto-inc) | 8 | `userId` -> `User.id`, `shopId` -> `Shop.id`, `itemId` -> `FoodItem.id` | Daily recurring scheduled food orders. |
| **`AuditLog`** | `id` (Int, Auto-inc) | 6 | `adminId` -> `User.id` | Immutable administrative audit trail with action and before/after details. |
| **`AutobookExecutionLog`**| `id` (Int, Auto-inc) | 6 | `scheduleId` -> `AutobookSchedule.id` | Background scheduler execution audit log. |

---

## 3. Referential Integrity & Deletion Rules

- **Restrict On Delete (`onDelete: Restrict`)**:
  - `Order.customerId` -> `User.id`: Prevents deleting user accounts that have historical order financial records.
  - `Order.shopId` -> `Shop.id`: Prevents deleting stalls that have past transaction history.
  - `OrderItem.itemId` -> `FoodItem.id`: Preserves menu items referenced in historical orders.
  - `Shop.ownerId` -> `User.id`: Preserves outlet ownership integrity.
  - `Review.customerId` -> `User.id` & `Review.shopId` -> `Shop.id`: Preserves rating ledger integrity.
- **Cascade On Delete (`onDelete: Cascade`)**:
  - `OrderItem.orderId` -> `Order.id`: Removing a draft or cancelled order cleans up associated order items.
  - `PaymentAttempt.orderId` -> `Order.id`: Cleans up payment attempts if an order is deleted.
  - `Review.orderId` -> `Order.id`: Cleans up associated review if an order is purged.
  - `UserRole.userId` -> `User.id`: Cleans up role associations when a user is deleted.
  - `ShopStaff.shopId` -> `Shop.id`: Cleans up staff mappings when a shop is removed.
  - `AutobookExecutionLog.scheduleId` -> `AutobookSchedule.id`: Cleans up logs on schedule deletion.
