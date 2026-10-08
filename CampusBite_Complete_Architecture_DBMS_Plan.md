# CampusBite — Complete Architecture, DBMS, Business Logic, Team Plan & Project Roadmap

**Reference environment:** VIT Chennai  
**Primary reference:** `CampusBite_DBMS_Full_Guide.pdf` supplied with the project  
**Document type:** DB-first implementation blueprint  
**Version:** 1.0

---

## 1. Executive Summary

CampusBite is a campus food pre-order and pickup platform for VIT Chennai. Students, teachers and other authorized users can discover food outlets, browse menus, place a pickup order, make payment, monitor preparation status, and collect the food by showing the order/payment proof at the stall. Shop staff receive and prepare orders, mark them ready, and complete handover. Shop owners manage menus, staff, timings and reports, while administrators manage the overall platform.

The supplied DBMS guide makes an important design point: CampusBite should **not be treated as only a CRUD web application**. The database itself should demonstrate ER modeling, relational design, normalization, integrity constraints, transactions, ACID properties, concurrency, indexing, query optimization, views, stored procedures/functions, triggers, audit/history, temporal data, analytics, security and advanced SQL.

This plan therefore follows a **database-first approach**:

```text
React + TypeScript
        |
        | HTTPS / REST
        v
Node.js + Express + TypeScript
        |
        | Parameterized SQL / Stored Procedures
        v
MySQL 8.0+ / InnoDB
        |
        +-- Constraints
        +-- Transactions
        +-- Indexes
        +-- Views
        +-- Procedures / Functions
        +-- Triggers
        +-- Audit / History
        +-- Analytics SQL
```

The guide recommends React + TypeScript, Node.js + Express, MySQL 8.0+, `mysql2`, JWT + bcrypt/Argon2, Postman/Bruno, Swagger/OpenAPI, Git/GitHub, Docker/Docker Compose and migrations through Flyway or Liquibase. It also recommends avoiding an ORM as the center of a DBMS academic project so that important SQL remains visible.

> **Core principle:** The frontend is a client, the backend is the policy layer, and MySQL is the durable source of transactional truth.

---

# 2. Scope and Product Boundaries

## 2.1 Main Actors

### Customer

A customer can be:

- Student
- Teacher
- Other authorized campus user

Customer operations:

1. Register/login
2. View campus areas
3. View shops
4. View shop timings
5. Browse food categories
6. Browse menu
7. View item availability
8. Add items to cart
9. Place order
10. Pay
11. Track order status
12. View order history
13. Review completed orders

### Shop Staff

Staff members can work for one or more shops.

Operations:

1. Login
2. View incoming orders for assigned shops
3. Accept/start preparation
4. Change order to `PREPARING`
5. Change order to `READY`
6. Verify pickup/payment proof
7. Mark order `COMPLETED`
8. View previous orders

A staff member **must not** be able to process orders from an unrelated shop.

### Shop Owner

Operations:

- Manage shop information
- Manage menu items
- Change prices
- Enable/disable items
- Manage shop staff
- Configure timings
- View sales
- View reviews
- View inventory information if inventory is implemented

### Administrator

Future/admin operations:

- Manage users
- Approve shops
- Disable shops
- Manage categories
- Resolve disputes
- View system-wide analytics
- Review audit logs

---

# 3. Version-1 Product Boundaries

To keep the first implementation manageable:

1. CampusBite is pickup-only.
2. One order belongs to exactly one shop.
3. A user ordering from two shops creates two separate orders.
4. Payment must be successfully confirmed before the shop prepares the order, unless a future configurable payment mode explicitly allows otherwise.
5. CampusBite stores payment references/status, not sensitive card/UPI credentials.
6. Historical orders are retained.
7. Shops and users should normally be deactivated/soft-deleted rather than physically deleted.
8. Redis is optional and should not be introduced until caching has a demonstrated need.
9. Database-backed cart is optional for MVP; frontend/session cart is simpler.

The one-shop-per-order rule is particularly important because it gives each order:

- One pickup location
- One preparation queue
- One shop authorization scope
- One order status
- One payment total
- Simpler transactions

---

# 4. Technology Stack

| Layer | Recommended technology | Reason |
|---|---|---|
| Frontend | React + TypeScript | Component architecture and type safety |
| Backend | Node.js + Express + TypeScript | REST API and easy SQL integration |
| Database | MySQL 8.0+ / InnoDB | Strong relational DBMS for the academic project |
| SQL access | `mysql2` | Explicit parameterized SQL |
| Authentication | JWT + bcrypt/Argon2 | Secure authentication |
| API testing | Postman or Bruno | API validation |
| API docs | Swagger/OpenAPI | Demonstrable API contract |
| Version control | Git + GitHub | Collaboration |
| Containers | Docker + Docker Compose | Reproducible environment |
| Migrations | Flyway/Liquibase or SQL migration scripts | Version-controlled schema |
| Cache | Redis, optional | Menu/cache experiments after MVP |

## Why MySQL?

The guide specifically identifies MySQL as suitable because it provides:

- Primary keys
- Foreign keys
- Transactions
- InnoDB
- CHECK constraints
- UNIQUE constraints
- Indexes
- Views
- Stored procedures
- Stored functions
- Triggers
- CTEs
- Window functions
- `EXPLAIN` / `EXPLAIN ANALYZE`
- Transaction isolation
- Referential integrity

## Why not make an ORM the center?

For a DBMS course, Prisma/Sequelize/TypeORM can hide the SQL concepts that need to be demonstrated.

Recommended approach:

> **Application code + parameterized handwritten SQL + selected stored procedures/views/triggers**

A small repository/data-access layer is fine, but important queries should remain visible as SQL.

---

# 5. High-Level Architecture

```text
                         CAMPUSBITE
                             |
             +---------------+---------------+
             |                               |
      Customer / Staff / Owner          Admin
             |
             v
     React + TypeScript
             |
          HTTPS/REST
             |
             v
     Node.js + Express
             |
       +-----+------------------------------+
       |                                    |
       | Auth / Authorization               |
       | Orders / Menu / Payment            |
       | Staff / Owner / Review             |
       | Validation / Services              |
       +----------------+-------------------+
                        |
                Parameterized SQL
                        |
                        v
                 MySQL 8.0+
                        |
       +----------------+----------------------+
       |                |                      |
   Transactional     History/Audit        Analytics SQL
       |                |                      |
   Users              Status History        Views
   Shops              Price History         CTEs
   Menu               Audit Log             Windows
   Orders                                  Reports
   Payments
   Reviews
```

Optional:

```text
React -> API -> Redis Cache -> MySQL
                    |
                cache miss
```

Redis should be added only when it solves an actual problem.

---

# 6. Layer Responsibilities

## Frontend

Responsible for:

- UI
- Forms
- Cart UX
- Client-side validation
- Loading/error states
- Order status display
- Staff dashboards
- Owner dashboards

Must **not** be trusted for:

- Final prices
- Payment truth
- Authorization
- Order state
- Availability truth

## Backend

Responsible for:

- Authentication
- Authorization
- Request validation
- Business workflow
- Transaction orchestration
- Payment integration
- Calling repositories
- Mapping DB errors to API errors

## Repository / SQL Layer

Responsible for:

- Parameterized SQL
- Transactions
- Joins
- Stored procedure calls
- Result mapping
- Query-specific indexes

## Database

Responsible for:

- Durable state
- PK/FK
- UNIQUE
- NOT NULL
- CHECK
- Transactions
- Referential integrity
- Selected state-machine/history enforcement
- Indexes
- Views
- Procedures/functions
- Triggers
- Audit/history

---

# 7. Complete User Workflow

## 7.1 Customer Flow

```text
LOGIN
  |
  v
SELECT CAMPUS AREA
  |
  v
SELECT SHOP
  |
  v
VIEW MENU
  |
  v
ADD ITEMS
  |
  v
CART VALIDATION
  |
  v
CHECKOUT
  |
  v
PAYMENT
  |
  v
PAYMENT CONFIRMED
  |
  v
ORDER CREATED / PLACED
  |
  v
STAFF PREPARING
  |
  v
ORDER READY
  |
  v
CUSTOMER ARRIVES
  |
  v
SHOW ORDER + PAYMENT PROOF
  |
  v
STAFF VERIFIES
  |
  v
COMPLETED
  |
  v
REVIEW
```

## 7.2 Recommended Payment Ordering

The safest design is:

```text
Validate cart
     |
Create payment intent
     |
Payment gateway
     |
SUCCESS / WEBHOOK
     |
Server verifies payment
     |
Create/confirm order transaction
     |
PLACED
```

If the payment gateway requires an internal order ID first:

```text
PAYMENT_PENDING
      |
      +---- PAYMENT_FAILED
      |
      +---- confirmed payment
                  |
                PLACED
```

The customer should never be able to manually change `PAYMENT_PENDING` to `PLACED`.

---

# 8. Order State Machine

Recommended states:

```text
PAYMENT_PENDING
       |
       +------> PAYMENT_FAILED
       |
       v
     PLACED
       |
       +------> CANCELLED
       |
       v
   PREPARING
       |
       +------> CANCELLED
       |
       v
     READY
       |
       v
   COMPLETED
```

Terminal states:

- `COMPLETED`
- `CANCELLED`
- `PAYMENT_FAILED`

Valid transitions:

| Current | Allowed next |
|---|---|
| PAYMENT_PENDING | PLACED, PAYMENT_FAILED, CANCELLED |
| PLACED | PREPARING, CANCELLED |
| PREPARING | READY, CANCELLED |
| READY | COMPLETED |
| COMPLETED | None |
| CANCELLED | None |
| PAYMENT_FAILED | PAYMENT_PENDING / CANCELLED |

Do **not** create a generic endpoint such as:

```http
PATCH /orders/:id
{
  "status": "anything"
}
```

Instead use:

```http
PATCH /api/staff/orders/:orderId/status
```

and validate the state transition.

---

# 9. Database — Most Important Section

## 9.1 Final Recommended Logical Model

```text
Users
 ├── Student_Profile
 ├── Teacher_Profile
 ├── User_Roles ─── Roles
 ├── Shop
 ├── Shop_Staff ─── Shop
 ├── Orders
 ├── Reviews
 └── Audit_Log

Area
 └── Shop
      ├── Shop_Staff
      ├── Shop_Timing
      └── Food_Item
            ├── Category
            └── Food_Item_Price_History

Orders
 ├── Order_Items ─── Food_Item
 ├── Payment_Attempt
 ├── Order_Status_History
 └── Review

Category
 └── Category
      (self-referencing parent_category_id)
```

---

# 10. Database Table Dictionary

| Table | PK | Important keys | Purpose |
|---|---|---|---|
| `Users` | `user_id` | `email UNIQUE` | Authentication identity |
| `Student_Profile` | `user_id` | `reg_no UNIQUE` | Student-specific data |
| `Teacher_Profile` | `user_id` | `employee_id UNIQUE` | Teacher-specific data |
| `Roles` | `role_id` | `role_name UNIQUE` | Role catalog |
| `User_Roles` | `(user_id, role_id)` | FKs | M:N user-role mapping |
| `Area` | `area_id` | `name UNIQUE` | Campus area |
| `Shop` | `shop_id` | owner + area FKs | Outlet |
| `Shop_Staff` | `(shop_id, staff_id)` | FKs | Staff assignment |
| `Shop_Timing` | `timing_id` | `shop_id` | Multiple daily intervals |
| `Category` | `category_id` | `parent_category_id` | Menu hierarchy |
| `Food_Item` | `item_id` | shop/category FKs | Current catalog |
| `Food_Item_Price_History` | `price_history_id` | item/user FKs | Historical pricing |
| `Orders` | `order_id` | customer/shop FKs | Order header |
| `Order_Items` | `order_item_id` | order/item FKs | Order lines |
| `Order_Status_History` | `history_id` | order/user FKs | State audit |
| `Payment_Attempt` | `payment_attempt_id` | order FK | Payment lifecycle |
| `Review` | `review_id` | order/customer/shop | Completed-order review |
| `Audit_Log` | `audit_id` | user FK | Cross-entity audit |

---

# 11. Identity and Role Design

The reference guide recommends separating authentication identity from student/teacher profiles.

Instead of putting everything in `Users`:

```text
Users
 ├── user_type
 ├── role
 └── reg_no
```

use:

```text
Users
 |
 +---- Student_Profile
 |
 +---- Teacher_Profile
```

Example:

```text
Student_Profile
----------------
user_id PK/FK
reg_no UNIQUE
hostel_area_id FK

Teacher_Profile
---------------
user_id PK/FK
employee_id UNIQUE
```

This demonstrates specialization/generalization and prevents unrelated profile attributes from being mixed into one table.

---

# 12. Role Design

For extensibility:

```text
Users
   |
   M:N
   |
User_Roles
   |
   M:N
   |
Roles
```

Example:

```text
Roles
-----
customer
staff
owner
admin
```

A user can then have:

```text
customer + staff
```

without modifying the `Users` table.

For a smaller implementation, an ENUM can work, but the M:N model is better for this project because it demonstrates another important relational concept.

---

# 13. Category Hierarchy

`Category.parent_category_id` creates a self-referencing relationship.

Example:

```text
Food
├── Fast Food
│   ├── Burgers
│   └── Sandwiches
├── Beverages
│   ├── Cold Drinks
│   └── Hot Drinks
└── South Indian
```

Example SQL:

```sql
SELECT
    child.name AS category,
    parent.name AS parent_category
FROM Category child
LEFT JOIN Category parent
    ON child.parent_category_id = parent.category_id;
```

A recursive CTE can later display the complete category tree.

---

# 14. Order_Items as an Associative Entity

There is an M:N relationship:

```text
Orders M:N Food_Item
```

because:

- One order contains many food items.
- One food item can appear in many orders.

Relational solution:

```text
Orders
   |
   1:N
   |
Order_Items
   |
   N:1
   |
Food_Item
```

This is one of the most important DBMS concepts in CampusBite.

---

# 15. Why `price_at_order` Is Essential

Suppose:

```text
Burger today = ₹80
```

Customer orders it.

Later:

```text
Burger = ₹100
```

If `Order_Items` stores only:

```text
item_id
```

historical order displays could incorrectly use ₹100.

Therefore:

```text
Order_Items
-----------
item_id
quantity
price_at_order
```

If the customer purchased at ₹80:

```text
price_at_order = 80
```

The current `Food_Item.price` represents the current catalog state.

The historical `Order_Items.price_at_order` represents the transaction-time price.

---

# 16. Recommended SQL Schema

## Users

```sql
CREATE TABLE Users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Student Profile

```sql
CREATE TABLE Student_Profile (
    user_id BIGINT PRIMARY KEY,
    reg_no VARCHAR(30) NOT NULL UNIQUE,
    hostel_area_id INT NULL,

    FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
);
```

## Teacher Profile

```sql
CREATE TABLE Teacher_Profile (
    user_id BIGINT PRIMARY KEY,
    employee_id VARCHAR(30) NOT NULL UNIQUE,

    FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
);
```

## Roles

```sql
CREATE TABLE Roles (
    role_id SMALLINT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE User_Roles (
    user_id BIGINT NOT NULL,
    role_id SMALLINT NOT NULL,

    PRIMARY KEY (user_id, role_id),

    FOREIGN KEY (user_id)
        REFERENCES Users(user_id),

    FOREIGN KEY (role_id)
        REFERENCES Roles(role_id)
);
```

## Area

```sql
CREATE TABLE Area (
    area_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL UNIQUE,
    description VARCHAR(255)
);
```

## Shop

```sql
CREATE TABLE Shop (
    shop_id INT PRIMARY KEY AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    area_id INT NOT NULL,
    name VARCHAR(120) NOT NULL,

    status ENUM(
        'ACTIVE',
        'INACTIVE',
        'SUSPENDED'
    ) NOT NULL DEFAULT 'ACTIVE',

    FOREIGN KEY (owner_id)
        REFERENCES Users(user_id),

    FOREIGN KEY (area_id)
        REFERENCES Area(area_id)
);
```

## Shop Staff

```sql
CREATE TABLE Shop_Staff (
    shop_id INT NOT NULL,
    staff_id BIGINT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (shop_id, staff_id),

    FOREIGN KEY (shop_id)
        REFERENCES Shop(shop_id),

    FOREIGN KEY (staff_id)
        REFERENCES Users(user_id)
);
```

## Shop Timing

Do not force exactly one timing interval per day.

Example:

```text
Monday
11:00–15:00
18:00–21:00
```

Use:

```sql
CREATE TABLE Shop_Timing (
    timing_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shop_id INT NOT NULL,
    day_of_week TINYINT NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,

    CHECK (day_of_week BETWEEN 0 AND 6),
    CHECK (open_time <> close_time),

    FOREIGN KEY (shop_id)
        REFERENCES Shop(shop_id)
);
```

If overnight opening is supported later, model it explicitly rather than assuming `open_time < close_time`.

## Category

```sql
CREATE TABLE Category (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    parent_category_id INT NULL,
    name VARCHAR(100) NOT NULL,

    FOREIGN KEY (parent_category_id)
        REFERENCES Category(category_id)
);
```

## Food Item

```sql
CREATE TABLE Food_Item (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    shop_id INT NOT NULL,
    category_id INT NOT NULL,

    name VARCHAR(140) NOT NULL,
    description VARCHAR(500),

    price DECIMAL(10,2) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (price >= 0),

    FOREIGN KEY (shop_id)
        REFERENCES Shop(shop_id),

    FOREIGN KEY (category_id)
        REFERENCES Category(category_id)
);
```

---

# 17. Orders and Order Items

```sql
CREATE TABLE Orders (
    order_id BIGINT PRIMARY KEY AUTO_INCREMENT,

    customer_id BIGINT NOT NULL,
    shop_id INT NOT NULL,

    status ENUM(
        'PAYMENT_PENDING',
        'PLACED',
        'PREPARING',
        'READY',
        'COMPLETED',
        'CANCELLED',
        'PAYMENT_FAILED'
    ) NOT NULL DEFAULT 'PAYMENT_PENDING',

    order_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    total_amount DECIMAL(10,2) NOT NULL,

    CHECK (total_amount >= 0),

    FOREIGN KEY (customer_id)
        REFERENCES Users(user_id),

    FOREIGN KEY (shop_id)
        REFERENCES Shop(shop_id)
);
```

```sql
CREATE TABLE Order_Items (
    order_item_id BIGINT PRIMARY KEY AUTO_INCREMENT,

    order_id BIGINT NOT NULL,
    item_id INT NOT NULL,

    quantity INT NOT NULL,
    price_at_order DECIMAL(10,2) NOT NULL,

    CHECK (quantity > 0),
    CHECK (price_at_order >= 0),

    FOREIGN KEY (order_id)
        REFERENCES Orders(order_id)
        ON DELETE CASCADE,

    FOREIGN KEY (item_id)
        REFERENCES Food_Item(item_id)
);
```

### Critical Integrity Issue

A simple FK:

```text
Order_Items.item_id -> Food_Item.item_id
```

proves only that the food item exists.

It does **not automatically prove**:

```text
Orders.shop_id = Food_Item.shop_id
```

Therefore this invalid state could theoretically occur:

```text
Order
shop_id = Shop A

Order_Items
item_id = Item belonging to Shop B
```

Solutions:

1. Backend validation
2. Stored procedure
3. Composite key design
4. Combination of application validation + database procedure

For the academic project, explicitly demonstrate this rule.

---

# 18. Order Status History

```sql
CREATE TABLE Order_Status_History (
    history_id BIGINT PRIMARY KEY AUTO_INCREMENT,

    order_id BIGINT NOT NULL,
    changed_by BIGINT NULL,

    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,

    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id)
        REFERENCES Orders(order_id),

    FOREIGN KEY (changed_by)
        REFERENCES Users(user_id)
);
```

Example:

```text
Order 1052

10:01  PAYMENT_PENDING -> PLACED
10:03  PLACED          -> PREPARING
10:17  PREPARING       -> READY
10:22  READY            -> COMPLETED
```

This provides:

- Auditability
- Temporal history
- Accountability
- Reporting
- Trigger opportunities

---

# 19. Payment Design

A simple 1:1 payment record is acceptable for a basic project, but the guide recommends the more realistic:

```text
Orders 1:N Payment_Attempt
```

because payment can fail and be retried.

Example:

```text
Attempt 1 -> FAILED
Attempt 2 -> FAILED
Attempt 3 -> SUCCESS
```

Recommended table:

```sql
CREATE TABLE Payment_Attempt (
    payment_attempt_id BIGINT PRIMARY KEY AUTO_INCREMENT,

    order_id BIGINT NOT NULL,

    provider_name VARCHAR(50),
    provider_reference VARCHAR(150),

    amount DECIMAL(10,2) NOT NULL,

    status ENUM(
        'PENDING',
        'SUCCESS',
        'FAILED',
        'REFUNDED'
    ) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (amount >= 0),

    FOREIGN KEY (order_id)
        REFERENCES Orders(order_id)
);
```

Important:

- Do not store card numbers.
- Do not store payment passwords/UPI PINs.
- Store provider transaction/reference IDs.
- Verify gateway callbacks.
- Verify payment amount against server-side order amount.

---

# 20. Review Design

```sql
CREATE TABLE Review (
    review_id BIGINT PRIMARY KEY AUTO_INCREMENT,

    order_id BIGINT NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    shop_id INT NOT NULL,

    rating TINYINT NOT NULL,
    comment VARCHAR(500),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (rating BETWEEN 1 AND 5),

    FOREIGN KEY (order_id)
        REFERENCES Orders(order_id),

    FOREIGN KEY (customer_id)
        REFERENCES Users(user_id),

    FOREIGN KEY (shop_id)
        REFERENCES Shop(shop_id)
);
```

Important business rule:

```text
Review.customer_id
must match
Orders.customer_id

Review.shop_id
must match
Orders.shop_id

Orders.status
must be COMPLETED
```

This requires deliberate application/procedure validation.

---

# 21. Historical Price Table

```sql
CREATE TABLE Food_Item_Price_History (
    price_history_id BIGINT PRIMARY KEY AUTO_INCREMENT,

    item_id INT NOT NULL,

    price DECIMAL(10,2) NOT NULL,

    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP NULL,

    changed_by BIGINT NULL,

    CHECK (price >= 0),

    FOREIGN KEY (item_id)
        REFERENCES Food_Item(item_id),

    FOREIGN KEY (changed_by)
        REFERENCES Users(user_id)
);
```

Example:

```text
Burger

₹70   Jan 1  - Mar 31
₹75   Apr 1  - Jun 30
₹80   Jul 1  - current
```

This introduces temporal data modeling.

---

# 22. Audit Log

```sql
CREATE TABLE Audit_Log (
    audit_id BIGINT PRIMARY KEY AUTO_INCREMENT,

    user_id BIGINT NULL,

    entity_name VARCHAR(80) NOT NULL,
    entity_id BIGINT NOT NULL,

    action VARCHAR(80) NOT NULL,

    old_value JSON NULL,
    new_value JSON NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
);
```

Useful actions:

```text
PRICE_CHANGED
ITEM_DISABLED
ORDER_STATUS_CHANGED
SHOP_STATUS_CHANGED
STAFF_ADDED
STAFF_REMOVED
```

---

# 23. Database Normalization

## 1NF

Requirements:

- Atomic values
- No repeating groups

Bad:

```text
item_id | prices
1       | 50,60,70
```

Good:

```text
Order_Items
-----------
order_item_id
order_id
item_id
quantity
price_at_order
```

Each row represents one item occurrence.

## 2NF

Remove partial dependency on part of a composite key.

`Shop_Staff` is a useful example:

```text
PRIMARY KEY(shop_id, staff_id)
```

`joined_at` belongs to the relationship, not independently to only one side.

## 3NF

Non-key attributes depend on:

> the key, the whole key, and nothing but the key.

For example, Area information should remain in `Area`:

```text
Shop
----
shop_id
area_id
```

rather than duplicating:

```text
area_name
area_description
```

in every Shop row.

## Functional Dependencies

Useful examples:

```text
user_id
    -> full_name, email, phone, password_hash

shop_id
    -> name, owner_id, area_id, status

item_id
    -> shop_id, category_id, name, price

order_id
    -> customer_id, shop_id, order_time, status, total_amount

(shop_id, staff_id)
    -> joined_at
```

---

# 24. Integrity Constraints

## Entity Integrity

```sql
PRIMARY KEY (user_id)
```

Primary keys cannot be NULL.

## Referential Integrity

```sql
FOREIGN KEY (shop_id)
REFERENCES Shop(shop_id)
```

## Domain Integrity

Examples:

```sql
CHECK (price >= 0)
CHECK (quantity > 0)
CHECK (rating BETWEEN 1 AND 5)
CHECK (amount >= 0)
```

## Business Integrity

Examples:

- Item belongs to order's shop.
- Staff belongs to shop.
- Review belongs to completed order.
- Payment amount equals order amount.
- Unavailable items cannot be ordered.
- Invalid order-state transitions are rejected.

---

# 25. Transactions and ACID

## Order Placement Transaction

Conceptually:

```sql
START TRANSACTION;

-- Validate customer
-- Validate shop
-- Validate every item
-- Verify item-shop relationship
-- Verify availability
-- Read current prices

INSERT INTO Orders (...);

INSERT INTO Order_Items (...);
INSERT INTO Order_Items (...);

-- Calculate and verify total

INSERT INTO Payment_Attempt (...);

COMMIT;
```

If anything important fails:

```sql
ROLLBACK;
```

## ACID

| Property | CampusBite |
|---|---|
| Atomicity | Order + items + payment operation succeeds together or rolls back |
| Consistency | Constraints and business rules preserve valid states |
| Isolation | Concurrent operations do not corrupt critical state |
| Durability | Committed transactions survive normal failures |

---

# 26. Concurrency Control

Inventory is an excellent future DBMS demonstration.

Problem:

```text
Stock = 1

Customer A sees 1
Customer B sees 1

A orders
B orders

Potential result:
stock = -1
```

If inventory is implemented:

```sql
START TRANSACTION;

SELECT stock_quantity
FROM Inventory
WHERE item_id = ?
FOR UPDATE;

-- validate stock

UPDATE Inventory
SET stock_quantity = stock_quantity - ?
WHERE item_id = ?;

COMMIT;
```

This demonstrates:

- Row locking
- Race conditions
- Isolation
- Concurrency
- Transactions

---

# 27. Optional Inventory Extension

```text
Inventory
---------
item_id PK/FK
stock_quantity
reorder_level
updated_at
```

Even better:

```text
Inventory_Transaction
---------------------
inventory_txn_id
item_id
quantity_change
txn_type
reference_id
created_at
```

Examples:

```text
+20 RESTOCK
-1  SALE
-2  SALE
+10 RESTOCK
```

The ledger makes stock changes auditable.

---

# 28. Business Rules

| ID | Rule | Enforcement |
|---|---|---|
| BR-01 | Shop belongs to exactly one area | FK + NOT NULL |
| BR-02 | Food item belongs to exactly one shop | FK |
| BR-03 | Order belongs to one customer and one shop | FKs |
| BR-04 | Order must contain at least one item before placement | Service/procedure |
| BR-05 | Quantity must be positive | CHECK |
| BR-06 | Item must belong to order's shop | Backend + procedure/composite design |
| BR-07 | Customer can review only own completed order | Authorization + DB validation |
| BR-08 | Normal order status cannot move backwards | State machine |
| BR-09 | Only assigned staff can process a shop's orders | Authorization + scoped SQL |
| BR-10 | Historical order prices remain unchanged | `price_at_order` |
| BR-11 | Payment amount must match order amount | Server verification |
| BR-12 | Unavailable item cannot be newly ordered | Transaction validation |
| BR-13 | User email is unique | UNIQUE |
| BR-14 | Student registration number is unique | UNIQUE |
| BR-15 | Teacher employee ID is unique | UNIQUE |

---

# 29. Logical and Syntax Edge Cases

## Input/Syntax

### Empty values

Distinguish:

```text
NULL
""
"   "
```

Do not treat all three as identical.

### Email

Normalize/trim email according to one documented rule before uniqueness checks.

### Unicode

Use:

```text
utf8mb4
```

for MySQL text.

### Money

Use:

```sql
DECIMAL(10,2)
```

Never use floating-point values for currency.

### Integer limits

Use BIGINT for IDs where high growth is expected.

### SQL Injection

Bad:

```typescript
const sql =
  "SELECT * FROM Users WHERE email = '" + email + "'";
```

Good:

```typescript
const sql =
  "SELECT * FROM Users WHERE email = ?";

connection.execute(sql, [email]);
```

### Invalid enum/status

Reject unknown values.

Do not silently convert:

```text
READY_NOW
```

to:

```text
READY
```

---

# 30. Business Edge Cases

## Item becomes unavailable after menu display

Frontend sees:

```text
Burger — Available
```

Before checkout, staff disables Burger.

Checkout must revalidate and reject that item.

## Price changes before checkout

Frontend shows:

```text
Burger ₹80
```

Current DB price becomes:

```text
₹85
```

Backend must use authoritative DB price and inform the customer.

## Shop closes during payment

Final order validation checks:

- Shop status
- Shop timing
- Item availability

## User pays but browser closes

Webhook/status verification must allow the order to complete safely.

## Double payment click

Use idempotency.

The second request should return the existing payment/order result instead of creating another transaction.

## Staff accesses another shop's order

Reject.

The SQL should be scoped by the authenticated staff member's assigned shop.

## Review before completion

Reject.

## Review for another user

Reject.

## Duplicate review

Reject using:

```sql
UNIQUE(order_id)
```

## User/shop deletion

Prefer:

```text
ACTIVE
INACTIVE
SUSPENDED
```

or soft-delete columns.

Do not delete historical financial/order records unnecessarily.

---

# 31. Referential Action Policy

| Relationship | Recommended policy | Reason |
|---|---|---|
| Orders → Order_Items | `ON DELETE CASCADE` | Line items have no meaning without order |
| Users → Orders | RESTRICT / soft delete | Preserve transaction history |
| Shop → Orders | RESTRICT / soft delete | Preserve sales history |
| Food_Item → Order_Items | RESTRICT | Historical order lines remain valid |
| Orders → Payment_Attempt | Preserve/restrict | Financial history should survive |

---

# 32. Indexing Strategy

Recommended indexes:

```sql
CREATE INDEX idx_shop_area
ON Shop(area_id);
```

```sql
CREATE INDEX idx_food_shop_available
ON Food_Item(shop_id, is_available);
```

```sql
CREATE INDEX idx_orders_customer_time
ON Orders(customer_id, order_time);
```

```sql
CREATE INDEX idx_orders_shop_status_time
ON Orders(shop_id, status, order_time);
```

```sql
CREATE INDEX idx_order_items_order
ON Order_Items(order_id);
```

```sql
CREATE INDEX idx_history_order_time
ON Order_Status_History(order_id, changed_at);
```

Indexes should be justified by actual query patterns.

---

# 33. Query Optimization Demonstration

Before index:

```sql
EXPLAIN
SELECT *
FROM Orders
WHERE customer_id = 25
ORDER BY order_time DESC;
```

Create:

```sql
CREATE INDEX idx_customer_order_time
ON Orders(customer_id, order_time);
```

Then:

```sql
EXPLAIN
SELECT *
FROM Orders
WHERE customer_id = 25
ORDER BY order_time DESC;
```

Compare:

- Possible key
- Chosen key
- Rows examined
- Access type
- Sorting
- Cost/time

This is much stronger for a DBMS evaluation than simply saying "we added indexes."

---

# 34. Views

Recommended views:

```text
vw_available_menu
vw_shop_sales
vw_customer_order_history
vw_active_orders
vw_shop_rating
vw_daily_shop_revenue
```

Example:

```sql
CREATE VIEW vw_available_menu AS
SELECT
    fi.item_id,
    fi.shop_id,
    s.name AS shop_name,
    fi.name AS item_name,
    c.name AS category_name,
    fi.price
FROM Food_Item fi
JOIN Shop s
    ON fi.shop_id = s.shop_id
JOIN Category c
    ON fi.category_id = c.category_id
WHERE fi.is_available = TRUE;
```

---

# 35. Stored Procedures

Good candidates:

## `sp_place_order`

Responsibilities:

1. Validate customer
2. Validate shop
3. Validate item-shop relationship
4. Validate availability
5. Read prices
6. Insert order
7. Insert order items
8. Calculate total
9. Create payment state
10. Commit/rollback

## `sp_change_order_status`

Responsibilities:

1. Find order
2. Validate staff authorization
3. Validate transition
4. Update order
5. Insert history
6. Commit

## `sp_add_food_item`

Creates validated menu item.

## `sp_shop_sales_report`

Produces owner sales data.

---

# 36. Stored Functions

Examples:

```text
fn_order_total(order_id)
fn_shop_rating(shop_id)
```

Use functions selectively.

Do not move every business rule into MySQL.

---

# 37. Triggers

Good candidates:

### Trigger 1 — Order Status History

When status changes:

```text
Orders.status
       |
       v
Order_Status_History
```

### Trigger 2 — Price Audit

When food-item price changes:

```text
Food_Item.price
       |
       v
Food_Item_Price_History
```

### Trigger 3 — Updated Timestamp

Automatically maintain:

```text
updated_at
```

Do not create triggers for every small validation because too many triggers make the system difficult to understand.

---

# 38. Advanced SQL

The project should demonstrate:

- INNER JOIN
- LEFT JOIN
- SELF JOIN
- Multiple JOINs
- Subqueries
- CTEs
- GROUP BY
- HAVING
- Aggregation
- Window functions

Example CTE:

```sql
WITH ShopRevenue AS (
    SELECT
        shop_id,
        SUM(total_amount) AS revenue
    FROM Orders
    WHERE status = 'COMPLETED'
    GROUP BY shop_id
)
SELECT *
FROM ShopRevenue
ORDER BY revenue DESC;
```

Window function:

```sql
SELECT
    shop_id,
    item_id,
    total_quantity,
    RANK() OVER (
        PARTITION BY shop_id
        ORDER BY total_quantity DESC
    ) AS item_rank
FROM ...;
```

---

# 39. Analytics and Innovation

## Innovation 1 — Order State Machine

Database/application enforced valid transitions.

## Innovation 2 — Historical Menu Pricing

Allows:

> "What did this item cost on a previous date?"

## Innovation 3 — Smart Queue / ETA

Possible inputs:

- Active orders
- Historical preparation time
- Shop load
- Item type
- Time of day

Current active order count:

```sql
SELECT
    shop_id,
    COUNT(*) AS active_orders
FROM Orders
WHERE status IN ('PLACED', 'PREPARING')
GROUP BY shop_id;
```

## Innovation 4 — SQL Recommendation Engine

Use item co-occurrence.

Example:

```text
Burger + Coke -> 20 orders
Burger + Fries -> 8 orders
Burger + Coffee -> 3 orders
```

Recommendation:

```text
Customers ordering Burger frequently also order Coke.
```

## Innovation 5 — Audit + Analytics

Combine:

- History
- Triggers
- Views
- CTEs
- Window functions
- Reporting

---

# 40. REST API

## Authentication

```http
POST /api/auth/register
POST /api/auth/login
```

## Areas

```http
GET /api/areas
```

## Shops

```http
GET /api/shops
GET /api/shops/:shopId
GET /api/shops/:shopId/menu
GET /api/shops/:shopId/timing
```

## Orders

```http
POST /api/orders
GET /api/orders/my-orders
GET /api/orders/:orderId
PATCH /api/orders/:orderId/cancel
```

## Payment

```http
POST /api/orders/:orderId/payment
POST /api/payments/webhook
```

## Staff

```http
GET /api/staff/orders
PATCH /api/staff/orders/:orderId/status
```

## Owner

```http
POST /api/owner/items
PATCH /api/owner/items/:itemId
DELETE /api/owner/items/:itemId
GET /api/owner/sales
```

## Reviews

```http
POST /api/reviews
GET /api/reviews/shop/:shopId
```

---

# 41. Backend Structure

```text
backend/
├── src/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── routes/
│   ├── middleware/
│   ├── validators/
│   ├── db/
│   │   ├── connection.ts
│   │   └── migrations/
│   ├── sql/
│   └── app.ts
├── tests/
└── package.json
```

The repository layer should keep SQL visible.

---

# 42. Frontend Structure

```text
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── hooks/
│   ├── services/
│   ├── types/
│   └── utils/
└── package.json
```

Main screens:

```text
Login
Register
Home
Areas
Shop Listing
Shop Menu
Cart
Checkout
Payment
Order Tracking
Order History
Profile
Staff Dashboard
Owner Dashboard
Admin Dashboard
```

---

# 43. Security Architecture

| Risk | Control |
|---|---|
| Password theft | Argon2id or bcrypt |
| SQL injection | Parameterized SQL |
| Unauthorized order access | User/shop scoped queries |
| Staff privilege escalation | RBAC + Shop_Staff |
| Payment tampering | Server-side amount verification |
| Fake gateway callback | Signature verification |
| Duplicate webhook | Idempotency |
| Database compromise | Least-privilege DB account |
| Sensitive logs | Never log passwords/payment secrets |

Never store plaintext passwords.

Never use MySQL root for the application.

Recommended application DB user:

```text
campusbite_app
```

with only required permissions.

---

# 44. Three-Person Work Division

The split is intentionally cross-functional.

**Every person contributes to the database.**

| Person | Primary ownership | Database contribution | Secondary contribution |
|---|---|---|---|
| Person 1 — DB & Backend Lead | Core DB + backend foundation | ERD, normalization, core tables, constraints, migrations, indexes, seed data, transaction framework | Auth APIs, repository layer, Docker/MySQL |
| Person 2 — Orders & Payments Lead | Customer checkout/order lifecycle | Orders, Order_Items, Payment_Attempt, Order_Status_History, stored procedures, transaction tests | Cart, checkout, payment adapter, idempotency |
| Person 3 — Shop & Analytics Lead | Staff/owner + analytics | Shop, Shop_Staff, Timing, Food_Item, Category, Price_History, Review, Audit_Log, views, CTE/window queries | Staff dashboard, owner dashboard, reports |

## Person 1

### Database

Own:

- Users
- Student_Profile
- Teacher_Profile
- Roles
- User_Roles
- Area
- Core constraints
- Migrations
- Index baseline

### Application

Own:

- Authentication
- Authorization middleware
- Database connection
- Repository pattern
- Docker setup

## Person 2

### Database

Own:

- Orders
- Order_Items
- Payment_Attempt
- Order_Status_History
- `sp_place_order`
- `sp_change_order_status`
- Transaction tests
- Concurrency tests

### Application

Own:

- Cart
- Checkout
- Payment integration
- Order tracking
- Idempotency

## Person 3

### Database

Own:

- Shop
- Shop_Staff
- Shop_Timing
- Category
- Food_Item
- Food_Item_Price_History
- Review
- Audit_Log
- Views
- CTEs
- Window-function analytics

### Application

Own:

- Staff dashboard
- Owner dashboard
- Menu management
- Sales reports
- Analytics UI

---

# 45. Shared Database Rules for the Team

All three members must:

1. Review SQL migrations through pull requests.
2. Understand PK/FK/UNIQUE/CHECK.
3. Understand normalization.
4. Understand the core business rules.
5. Write at least one DB/API test.
6. Document every table they add.
7. Document:
   - Purpose
   - PK
   - FKs
   - Constraints
   - Delete policy
   - Index rationale
   - Example query

No member should merge a migration they cannot explain during the DBMS viva.

---

# 46. Git Workflow

```text
main
  |
  v
develop
  |
  +-- feature/person1-schema-auth
  |
  +-- feature/person2-orders-payment
  |
  +-- feature/person3-shop-analytics
```

Recommended rule:

```text
feature branch
    |
Pull Request
    |
DB review by another member
    |
Tests
    |
Merge
```

---

# 47. Project Phases

## Phase 0 — Project Setup

Deliverables:

- Git repository
- README
- Coding standards
- Issue board
- Local environment
- Docker/MySQL

Exit criteria:

> All three members can run the project locally.

---

## Phase 1 — Requirements

Document:

- Actors
- Use cases
- Functional requirements
- Non-functional requirements
- Business rules
- Scope boundaries

Exit criteria:

> No ambiguity in the core customer → payment → pickup workflow.

---

## Phase 2 — ER Modeling

Create:

- Entities
- Attributes
- PKs
- FKs
- Relationships
- Cardinalities
- Participation constraints
- Recursive category relationship
- Student/teacher specialization

Exit criteria:

> Team freezes ERD.

---

## Phase 3 — Relational Mapping and Normalization

Document:

```text
ERD
 |
 v
Relational schema
 |
 v
1NF
 |
 v
2NF
 |
 v
3NF
```

Also document functional dependencies.

Exit criteria:

> ERD and relational schema are consistent.

---

## Phase 4 — Database Implementation

Build:

```text
01_schema.sql
02_constraints.sql
03_indexes.sql
04_seed.sql
05_views.sql
06_functions.sql
07_procedures.sql
08_triggers.sql
09_analytics.sql
```

Add migrations.

Exit criteria:

> All core DB tests pass.

---

## Phase 5 — Backend Core

Implement:

- Authentication
- Authorization
- Shop APIs
- Menu APIs
- Repository layer
- Validation
- Error handling

Exit criteria:

> Backend reads/writes MySQL using safe parameterized SQL.

---

## Phase 6 — Customer Ordering

Implement:

- Shop listing
- Menu
- Cart
- Checkout
- Payment
- Order tracking
- Order history

Exit criteria:

> Valid order can travel from menu to payment to PLACED.

---

## Phase 7 — Staff and Owner

Implement:

- Staff queue
- Order status state machine
- Pickup verification
- Menu management
- Staff management
- Timings
- Sales reports

Exit criteria:

> Staff can process only authorized shop orders.

---

## Phase 8 — Payment Hardening

Implement:

- Payment attempts
- Gateway webhook
- Idempotency
- Amount verification
- Retry
- Reconciliation
- Refund state

Exit criteria:

> Repeated payment requests cannot duplicate an order.

---

## Phase 9 — Analytics

Implement:

- Shop sales
- Top items
- Ratings
- Peak hours
- Active orders
- Queue estimate
- Recommendations

Exit criteria:

> Analytics queries demonstrate joins, aggregation, CTEs and window functions.

---

## Phase 10 — Optimization and Security

Implement:

- EXPLAIN experiments
- Composite indexes
- Least privilege
- SQL injection tests
- Authorization tests
- Password hashing
- Payment verification

Exit criteria:

> Performance/security checklist passes.

---

## Phase 11 — Final Integration

Deliver:

- E2E testing
- Documentation
- Demo data
- DBMS viva script
- Screenshots
- Final report
- Final presentation

Exit criteria:

> No blocker defects and all three members can explain the complete architecture.

---

# 48. Testing Matrix

| Test | Expected result |
|---|---|
| Duplicate email | Rejected |
| Invalid shop FK | Rejected |
| Negative item price | Rejected |
| Quantity = 0 | Rejected |
| Invalid rating | Rejected |
| Wrong-shop item | Rejected |
| Empty order | Rejected |
| Invalid status transition | Rejected |
| Unauthorized staff | Rejected |
| Review before completion | Rejected |
| Review for another customer | Rejected |
| Duplicate review | Rejected |
| Payment amount mismatch | Rejected/reconciled |
| Duplicate webhook | Idempotent |
| DB failure during order | Rollback |
| Concurrent inventory purchase | No overselling if inventory enabled |
| Inactive shop | New orders blocked |
| Unavailable item at checkout | Order rejected/updated |
| SQL injection payload | Treated as data |

---

# 49. Detailed Case Study

## Scenario

A VIT Chennai student wants to pre-order:

```text
1 Sandwich
2 Juices
```

from a campus food outlet.

---

## Step 1 — Login

Student enters:

```text
email
password
```

Backend:

1. Finds user by indexed email.
2. Verifies password hash.
3. Loads roles.
4. Creates authenticated session/token.

DBMS concepts:

- UNIQUE
- Index
- Parameterized query
- Authentication

---

## Step 2 — Discover Shop

Student chooses a campus area.

Example:

```sql
SELECT
    shop_id,
    name,
    status
FROM Shop
WHERE area_id = ?
  AND status = 'ACTIVE'
ORDER BY name;
```

DBMS concepts:

- FK
- Selection
- Index
- JOIN

---

## Step 3 — View Menu

```sql
SELECT
    fi.item_id,
    fi.name,
    c.name AS category,
    fi.price,
    fi.description
FROM Food_Item fi
JOIN Category c
    ON fi.category_id = c.category_id
WHERE fi.shop_id = ?
  AND fi.is_available = TRUE
ORDER BY c.name, fi.name;
```

DBMS concepts:

- INNER JOIN
- Filtering
- Indexing
- Normalized category data

---

## Step 4 — Add to Cart

Student selects:

```text
Sandwich x1
Juice x2
```

Frontend calculates a display estimate.

Backend must independently verify:

- Shop
- Items
- Availability
- Current prices
- Quantities
- Same-shop constraint

---

## Step 5 — Payment

Backend creates payment attempt.

Gateway:

```text
SUCCESS
```

or webhook reports:

```text
SUCCESS
```

Backend verifies:

- Signature
- Provider reference
- Amount
- Order/payment identity

---

## Step 6 — Place Order Transaction

```sql
START TRANSACTION;

-- validate customer
-- validate shop
-- validate item/shop relationship
-- validate availability
-- read prices

INSERT INTO Orders (...);

INSERT INTO Order_Items (...);
INSERT INTO Order_Items (...);

-- calculate/verify total

INSERT INTO Payment_Attempt (...);

COMMIT;
```

If any critical operation fails:

```sql
ROLLBACK;
```

---

## Step 7 — Staff Processing

Staff sees:

```text
Order #1052

Sandwich x1
Juice x2

Total: ₹180

Status: PLACED
```

Staff changes:

```text
PLACED
   ↓
PREPARING
   ↓
READY
```

Each transition creates:

```text
Order_Status_History
```

---

## Step 8 — Pickup

Student reaches the stall.

Shows:

```text
Order #1052
```

and payment proof/QR.

Staff verifies:

1. Order exists.
2. Order belongs to this shop.
3. Payment is successful.
4. Order is `READY`.
5. Staff belongs to this shop.

Then:

```text
READY
  ↓
COMPLETED
```

---

## Step 9 — Review

Student can now submit:

```text
Rating: 5
Comment: Very fast service.
```

Backend checks:

```text
authenticated user
        =
order customer

AND

order status = COMPLETED

AND

review does not already exist
```

---

## Step 10 — Analytics

Owner can see:

```text
Total completed orders
Revenue
Top-selling items
Average rating
Peak hours
Active queue
```

Database can produce this through:

- Views
- Aggregation
- CTEs
- Window functions

---

# 50. Example Failure Case

Suppose the student sees:

```text
Burger ₹80
```

Then the owner changes it to:

```text
Burger ₹90
```

before checkout.

The frontend is not authoritative.

Backend queries:

```sql
SELECT price, is_available, shop_id
FROM Food_Item
WHERE item_id = ?;
```

It discovers:

```text
₹90
```

CampusBite should:

1. Detect the price change.
2. Inform the customer.
3. Use ₹90 for the transaction.
4. Store:

```text
price_at_order = 90
```

This protects historical correctness.

---

# 51. Another Failure Case — Wrong Shop Item

Suppose:

```text
Order.shop_id = Shop A
```

but someone attempts:

```text
item_id = item from Shop B
```

The database FK alone may not detect the mismatch.

Therefore `sp_place_order` or backend validation must verify:

```text
Food_Item.shop_id = Orders.shop_id
```

If false:

```text
ROLLBACK
```

and return a validation error.

This is an excellent DBMS viva question.

---

# 52. Payment Failure Case

```text
PAYMENT_PENDING
      |
      v
PAYMENT_FAILED
```

Customer can retry.

Retry:

```text
PAYMENT_PENDING
      |
      v
SUCCESS
      |
      v
PLACED
```

Multiple payment attempts are retained.

---

# 53. Duplicate Payment Case

User taps:

```text
Pay
Pay
```

twice.

Without idempotency:

```text
Payment 1 -> SUCCESS
Payment 2 -> SUCCESS
```

Potentially dangerous.

With idempotency:

```text
Request 1 -> creates payment
Request 2 -> returns existing payment
```

Use:

- Idempotency key
- Provider reference UNIQUE constraint
- Transaction-safe backend logic

---

# 54. Smart Queue Extension

Current queue:

```sql
SELECT
    shop_id,
    COUNT(*) AS active_orders
FROM Orders
WHERE status IN ('PLACED', 'PREPARING')
GROUP BY shop_id;
```

Can produce:

```text
Shop A
Active orders: 8
Estimated wait: 18 min

Shop B
Active orders: 2
Estimated wait: 5 min
```

Later the estimate can use:

- Historical preparation time
- Item mix
- Current active order count
- Time of day

---

# 55. Database Demonstration for Final Viva

## Demo 1 — ER Diagram

Explain:

- Entities
- PK
- FK
- 1:1
- 1:N
- M:N
- Recursive relationship
- Specialization

## Demo 2 — Normalization

Show:

```text
UNF
 ↓
1NF
 ↓
2NF
 ↓
3NF
```

## Demo 3 — Constraints

Attempt:

```text
negative price
duplicate email
invalid rating
quantity = 0
```

Show MySQL rejection.

## Demo 4 — Transaction

Create valid order.

Then intentionally cause an error.

Show:

```text
ROLLBACK
```

## Demo 5 — Trigger

Change:

```text
PLACED -> PREPARING
```

Show automatic history row.

## Demo 6 — Stored Procedure

Call:

```text
sp_change_order_status(...)
```

Attempt an invalid transition.

Show rejection.

## Demo 7 — Indexing

Show:

```text
EXPLAIN
```

before and after index.

## Demo 8 — Advanced SQL

Demonstrate:

- CTE
- Window function
- Subquery
- Aggregation
- Multiple joins

## Demo 9 — Analytics

Show:

- Top shops
- Top items
- Revenue
- Peak hours
- Average rating
- Active orders

## Demo 10 — Security

Explain:

- Password hashing
- Parameterized SQL
- Authentication
- Authorization
- Least privilege

---

# 56. Project Folder Structure

```text
CampusBite/
│
├── frontend/
│   ├── src/
│   └── package.json
│
├── backend/
│   ├── src/
│   ├── tests/
│   └── package.json
│
├── database/
│   ├── 01_schema.sql
│   ├── 02_constraints.sql
│   ├── 03_indexes.sql
│   ├── 04_seed.sql
│   ├── 05_views.sql
│   ├── 06_functions.sql
│   ├── 07_procedures.sql
│   ├── 08_triggers.sql
│   ├── 09_analytics.sql
│   └── migrations/
│
├── docs/
│   ├── ERD.png
│   ├── relational-schema.md
│   ├── business-rules.md
│   ├── normalization.md
│   ├── API.md
│   └── DBMS-demo.md
│
├── docker-compose.yml
├── README.md
└── .gitignore
```

---

# 57. Final Deliverables

The final project should contain:

- ER diagram
- Relational schema
- Normalization report
- Functional dependencies
- Business rules
- MySQL schema
- Migrations
- Seed data
- Constraints
- Indexes
- Views
- Stored procedures
- Stored functions
- Triggers
- Audit/history
- Backend REST API
- React frontend
- Authentication
- Authorization
- Payment workflow
- Staff workflow
- Owner workflow
- Testing matrix
- Security checklist
- EXPLAIN optimization evidence
- Analytics queries
- Final case study
- DBMS viva demonstration

---

# 58. Final Recommended Architecture

The strongest practical version of CampusBite is:

```text
                 CAMPUSBITE
                     |
       +-------------+-------------+
       |                           |
   Transactional DB           Analytics
       |                           |
   Users                         Views
   Shops                         CTEs
   Menu                          Windows
   Orders                        Reports
   Payments                      Recommendations
   Reviews
   Inventory*
       |
   Constraints
   Transactions
   Procedures
   Functions
   Triggers
   Audit/History
```

`Inventory` is optional for the first release.

The project should proceed in this order:

```text
DATABASE
   ↓
BACKEND
   ↓
CUSTOMER FLOW
   ↓
STAFF / OWNER
   ↓
PAYMENT HARDENING
   ↓
ANALYTICS
   ↓
OPTIMIZATION
   ↓
SECURITY
   ↓
FINAL INTEGRATION
```

This minimizes rework because the application is built around a stable relational model.

---

# 59. Most Important Design Rules

1. **Do not trust the frontend for prices.**
2. **Do not trust the frontend for authorization.**
3. **Do not trust the frontend for payment success.**
4. **Do not allow arbitrary order-status updates.**
5. **Do not allow an order to contain items from another shop.**
6. **Do not lose historical transaction prices.**
7. **Do not delete important financial/order history casually.**
8. **Do not concatenate user input into SQL.**
9. **Do not use MySQL root for the application.**
10. **Do not let only one team member understand the database.**
11. **Every member must contribute to DB design and testing.**
12. **Use transactions for multi-step order/payment operations.**
13. **Use indexes because of query patterns, not randomly.**
14. **Use triggers selectively for automatic history/audit.**
15. **Keep the ERD, SQL schema and application model consistent.**

---

# 60. Source Basis and Assumptions

The primary source for this report is the uploaded:

> `CampusBite_DBMS_Full_Guide.pdf`

The guide provides the core CampusBite scope, DBMS architecture, recommended technology stack, actor workflows, schema improvements, normalization discussion, business rules, transaction/concurrency guidance, advanced SQL, security, project phases, testing strategy, innovations and final DBMS demonstration approach.

The report deliberately preserves the guide's central terminology:

- `Users`
- `Student_Profile`
- `Teacher_Profile`
- `Area`
- `Shop`
- `Shop_Staff`
- `Category`
- `Food_Item`
- `Food_Item_Price_History`
- `Orders`
- `Order_Items`
- `Order_Status_History`
- `Payment_Attempt`
- `Review`
- `Inventory`
- `Inventory_Transaction`
- `Audit_Log`
- `Roles`
- `User_Roles`

Where the guide describes an optional or future feature, this document keeps it optional rather than making it a mandatory MVP dependency.

Where exact VIT Chennai operational details such as current stall list, exact timings, payment provider or inventory quantities are not defined by the supplied guide, those should be treated as configurable data rather than hard-coded facts.

---

# 61. Final Recommendation for the Team

For a strong academic and technically convincing CampusBite project:

### MVP

Implement:

```text
Users
Student/Teacher Profiles
Roles
Areas
Shops
Shop Staff
Shop Timings
Categories
Food Items
Orders
Order Items
Payment Attempts
Order Status History
Reviews
```

Then strengthen it with:

```text
Constraints
Normalization
Indexes
Transactions
Stored Procedures
Functions
Triggers
Views
Audit History
Temporal Pricing
Advanced SQL
Security
Analytics
```

Finally, implement 3–5 meaningful innovations:

```text
Smart Queue Estimation
+
Order State Machine
+
Historical Price Tracking
+
SQL Recommendations
+
Audit / Analytics
```

The goal is not to have the largest number of tables.

The goal is to demonstrate that the **database solves real application problems**.

That gives CampusBite the character of:

- A usable campus application
- A properly normalized relational database
- A strong DBMS project
- A transaction-processing system
- An advanced SQL demonstration
- An analytics platform
- A strong DBMS viva/project-evaluation candidate
