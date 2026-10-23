# Database Engine Resolution: Runtime PostgreSQL vs Coursework MySQL Scripts

## 1. Executive Summary & Objective Finding
During our independent audit of the Campus Bites codebase, we investigated whether the application executes against MySQL or PostgreSQL. 

**Objective Finding:**
The running application operates **100% on PostgreSQL via Prisma Client**. The MySQL scripts located in `database/*.sql` are **academic coursework demonstration artifacts** preserved for curriculum evaluation (demonstrating MySQL DDL, Views, Triggers, and Stored Procedures), but they are **not executed** by the running web application.

---

## 2. Technical Evidence Map

| Investigation Area | MySQL Evidence (`database/*.sql`) | Runtime PostgreSQL Evidence (`backend/`) | Verdict |
| :--- | :--- | :--- | :--- |
| **Connection Modules** | `backend/src/db/connection.ts` originally imported `mysql2/promise`. That file was **deleted** during standardization because no controller used it. | `backend/src/db/prisma.ts` exports `new PrismaClient()` with connection pooling. Used by all controllers. | **Prisma PostgreSQL is Authoritative** |
| **Dependencies** | No `mysql2` in `backend/package.json`. | `@prisma/client: ^5.22.0` and `prisma: ^5.22.0` in `backend/package.json`. | **PostgreSQL Only** |
| **Schema Definition** | `database/01_schema.sql` defines MySQL dialect (`AUTO_INCREMENT`, `VARCHAR`, `TIMESTAMP`). | `backend/prisma/schema.prisma` declares `provider = "postgresql"`. | **PostgreSQL Authoritative** |
| **Data Types** | MySQL `TINYINT(1)` for booleans, `BIGINT AUTO_INCREMENT`. | PostgreSQL `Boolean`, `Int @default(autoincrement())`, `DateTime`. | **PostgreSQL Authoritative** |
| **Environment Configuration** | No MySQL connection string in `.env` or `config/env.ts`. | `DATABASE_URL=postgresql://...` and `DIRECT_URL=postgresql://...` in `.env`. | **PostgreSQL Authoritative** |
| **Migrations** | No MySQL migration tracking system. | Prisma migration history in `backend/prisma/migrations/` tracks 3 versioned migrations deployed to Supabase PostgreSQL. | **PostgreSQL Authoritative** |

---

## 3. Academic Value of the Preserved MySQL Scripts

The files in `database/` demonstrate advanced relational database concepts:
1. `01_schema.sql`: Normalization, primary and foreign keys, cascade delete rules.
2. `02_indexes.sql`: B-tree index creation syntax.
3. `03_views.sql`: Stored relational views (`v_active_menu`, `v_stall_order_queue`, `v_stall_daily_summary`, `v_order_item_details`).
4. `04_triggers.sql`: Event-driven automated triggers (`trg_after_order_item_insert`, `trg_prevent_duplicate_review`).
5. `05_procedures.sql`: Stored procedures with ACID transaction blocks (`sp_place_order`, `sp_update_order_status`).
6. `06_seed.sql`: Relational test data seeding.

These coursework scripts are preserved for academic grading, but are safely decoupled from the operational cloud database.
