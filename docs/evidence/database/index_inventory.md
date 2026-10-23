# Comprehensive Index Inventory & Justification

This document catalogs all 28 indexes currently active in the PostgreSQL runtime database, the queries they support, and their empirical performance justification.

---

## 1. Primary Key & Unique Indexes (Enforced by Database Engine)

| # | Index Name | Table | Columns | Type | Justification / Constraint Enforced |
|---|:---|:---|:---|:---:|:---|
| 1 | `User_pkey` | `User` | `id` | Unique B-tree | Primary Key lookup for authentication and relations. |
| 2 | `User_email_key` | `User` | `email` | Unique B-tree | Prevents duplicate user registration; fast $O(\log N)$ lookup during login. |
| 3 | `Role_pkey` | `Role` | `id` | Unique B-tree | Primary Key lookup for system roles. |
| 4 | `Role_name_key` | `Role` | `name` | Unique B-tree | Enforces distinct role names (`CUSTOMER`, `STAFF`, `OWNER`, `ADMIN`). |
| 5 | `UserRole_pkey` | `UserRole` | `id` | Unique B-tree | Primary Key lookup for user-role assignments. |
| 6 | `UserRole_userId_roleId_key` | `UserRole` | `userId, roleId` | Unique B-tree | Prevents assigning duplicate roles to the same user account. |
| 7 | `Area_pkey` | `Area` | `id` | Unique B-tree | Primary Key lookup for dining areas. |
| 8 | `Area_name_key` | `Area` | `name` | Unique B-tree | Prevents duplicate campus food court zone names. |
| 9 | `Shop_pkey` | `Shop` | `id` | Unique B-tree | Primary Key lookup for outlets. |
| 10| `ShopStaff_pkey` | `ShopStaff` | `id` | Unique B-tree | Primary Key lookup for staff assignments. |
| 11| `ShopStaff_shopId_staffId_key`| `ShopStaff` | `shopId, staffId` | Unique B-tree | Prevents duplicate assignment of the same staff member to an outlet. |
| 12| `Category_pkey` | `Category` | `id` | Unique B-tree | Primary Key lookup for food categories. |
| 13| `Category_name_key` | `Category` | `name` | Unique B-tree | Enforces unique food category taxonomy. |
| 14| `FoodItem_pkey` | `FoodItem` | `id` | Unique B-tree | Primary Key lookup for catalog items. |
| 15| `Order_pkey` | `Order` | `id` | Unique B-tree | Primary Key lookup for customer orders and token assignment. |
| 16| `Order_idempotencyKey_key` | `Order` | `idempotencyKey` | Unique B-tree | Prevents duplicate order creation from double-clicks or network retries. |
| 17| `OrderItem_pkey` | `OrderItem` | `id` | Unique B-tree | Primary Key lookup for order line items. |
| 18| `PaymentAttempt_pkey` | `PaymentAttempt`| `id` | Unique B-tree | Primary Key lookup for payment attempts. |
| 19| `Review_pkey` | `Review` | `id` | Unique B-tree | Primary Key lookup for feedback reviews. |
| 20| `Review_orderId_key` | `Review` | `orderId` | Unique B-tree | Enforces strictly one review per verified completed purchase. |
| 21| `AutobookSchedule_pkey` | `AutobookSchedule` | `id` | Unique B-tree | Primary Key lookup for recurring schedules. |
| 22| `AuditLog_pkey` | `AuditLog` | `id` | Unique B-tree | Primary Key lookup for immutable audit records. |
| 23| `AutobookExecutionLog_pkey`| `AutobookExecutionLog` | `id` | Unique B-tree | Primary Key lookup for autobook worker execution logs. |

---

## 2. Foreign Key & Query Performance Indexes

| # | Index Name | Table | Columns | Type | Target Query / Workload Supported |
|---|:---|:---|:---|:---:|:---|
| 24| `Order_customerId_idx` | `Order` | `customerId` | Non-unique B-tree | Speeds up customer order history lookups (`WHERE customerId = $1`). |
| 25| `Order_shopId_idx` | `Order` | `shopId` | Non-unique B-tree | Supports outlet filtering and staff queue joins. |
| 26| `Order_status_idx` | `Order` | `status` | Non-unique B-tree | Supports status aggregation for admin overview KPIs. |
| 27| `Order_orderTime_idx` | `Order` | `orderTime` | Non-unique B-tree | Supports chronological sorting and today's sales filtering (`orderTime >= startOfToday`). |
| 28| `Order_shopId_status_idx`| `Order` | `shopId, status` | Compound B-tree | Powers the live kitchen monitor (`WHERE shopId = $1 AND status IN ('PLACED', 'PREPARING', 'READY')`). Eliminates full table scan on stall queues. |
| 29| `OrderItem_orderId_idx` | `OrderItem` | `orderId` | Non-unique B-tree | Supports order detail retrieval and cascade deletions. |
| 30| `OrderItem_itemId_idx` | `OrderItem` | `itemId` | Non-unique B-tree | Supports sales aggregation and top-selling food items metrics. |
| 31| `FoodItem_shopId_idx` | `FoodItem` | `shopId` | Non-unique B-tree | Speeds up outlet menu retrieval. |
| 32| `FoodItem_categoryId_idx`| `FoodItem` | `categoryId` | Non-unique B-tree | Supports category-based browsing. |
| 33| `FoodItem_isAvailable_idx`| `FoodItem` | `isAvailable` | Non-unique B-tree | Filters available items for customer browsing. |
| 34| `FoodItem_isDynamicPricing_idx`| `FoodItem` | `isDynamicPricing` | Non-unique B-tree | Supports dynamic pricing clearance aggregation. |
| 35| `PaymentAttempt_orderId_idx`| `PaymentAttempt`| `orderId` | Non-unique B-tree | Supports payment reconciliation and cascade delete. |
| 36| `PaymentAttempt_status_idx`| `PaymentAttempt`| `status` | Non-unique B-tree | Filters verified paid orders (`status = 'SUCCESS'`). |
| 37| `Review_customerId_idx` | `Review` | `customerId` | Non-unique B-tree | Supports customer review history. |
| 38| `Review_shopId_idx` | `Review` | `shopId` | Non-unique B-tree | Speeds up stall review list and average rating computation. |
| 39| `Review_rating_idx` | `Review` | `rating` | Non-unique B-tree | Supports star-rating filtering and distribution metrics. |
| 40| `AutobookSchedule_userId_idx`| `AutobookSchedule`| `userId` | Non-unique B-tree | Speeds up customer schedule lookups. |
| 41| `AutobookSchedule_isActive_scheduledTime_idx`| `AutobookSchedule`| `isActive, scheduledTime` | Compound B-tree | Powers the background worker sweep (`WHERE isActive = true AND scheduledTime = $1`). |
| 42| `AuditLog_adminId_idx` | `AuditLog` | `adminId` | Non-unique B-tree | Filters audit records by administrator ID. |
| 43| `AuditLog_entity_idx` | `AuditLog` | `entity` | Non-unique B-tree | Filters audit records by target entity (`SHOP`, `USER`, `ORDER`, `SYSTEM`). |
| 44| `AuditLog_createdAt_idx`| `AuditLog` | `createdAt` | Non-unique B-tree | Supports chronological audit log pagination. |
| 45| `AutobookExecutionLog_scheduleId_idx`| `AutobookExecutionLog`| `scheduleId` | Non-unique B-tree | Retrieves execution history for a recurring schedule. |
| 46| `AutobookExecutionLog_attemptTime_idx`| `AutobookExecutionLog`| `attemptTime` | Non-unique B-tree | Supports scheduler debugging and monitoring. |
