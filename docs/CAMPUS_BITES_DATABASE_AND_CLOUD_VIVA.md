# Campus Bites — Database & Cloud Optimization Viva Defense Guide

This comprehensive viva guide provides beginner-friendly yet technically rigorous answers to likely faculty examination questions regarding the database architecture, query optimization, cloud infrastructure, and reliability engineering of Campus Bites.

---

# SECTION 1: DATABASE ARCHITECTURE & OPTIMIZATION QUESTIONS

### 1. What exactly did you optimize in the database?
**Answer:** We optimized four specific tiers:
1. **Query Architecture:** Replaced unbounded in-memory array processing in the Admin Dashboard with native PostgreSQL database-level `aggregate` (`sum`, `avg`) and `groupBy` operations.
2. **Indexing Structure:** Introduced targeted compound B-tree indexes (such as `[shopId, status]` on `Order` and `[shopId, isAvailable]` on `FoodItem`) to eliminate full table sequential scans and in-memory quicksorts.
3. **Column Projection:** Eliminated overfetching by replacing `include: { customer: true }` (which pulled all user fields including sensitive `passwordHash`) with strict `select` projections, reducing execution memory buffer row width from 83 bytes to 33 bytes.
4. **Connection Pooling:** Standardized Prisma Client connection pooling (`connection_limit=7`) to multiplex web requests safely through PgBouncer without exhausting Supabase connection ceilings.
*Code References:* [`backend/src/controllers/adminController.ts:55`](file:///D:/Campus%20Bites/backend/src/controllers/adminController.ts#L55), [`backend/prisma/schema.prisma:144`](file:///D:/Campus%20Bites/backend/prisma/schema.prisma#L144).

---

### 2. What was the original problem?
**Answer:** The original application suffered from three major database architectural flaws:
1. **Unbounded Memory Drain:** The Admin Overview endpoint loaded all 2,645 orders with 4 nested table joins and all 5,208 order items into the Node.js process heap, taking **3,585 ms** per request and consuming >30MB of RAM.
2. **Negative Filtering in Kitchen Queues:** The staff active orders query used `status NOT IN ('COMPLETED', 'CANCELLED', 'PAYMENT_FAILED')`. In PostgreSQL, negative filters force the planner to scan large row subsets rather than seeking directly to active orders.
3. **Overfetching and Sort Overhead:** Single-column indexes on `customerId` and `shopId` forced the database to perform index scans followed by in-memory `Sort (quicksort)` operations to satisfy `ORDER BY orderTime DESC`.
*Evidence:* [`docs/evidence/performance/explain_plans_raw.md`](file:///D:/Campus%20Bites/docs/evidence/performance/explain_plans_raw.md).

---

### 3. Which queries were optimized?
**Answer:** We benchmarked and optimized 7 representative production queries:
1. **Customer Order History:** `WHERE customerId = $1 ORDER BY orderTime DESC`.
2. **Staff Kitchen Active Queue:** `WHERE shopId = $1 AND status IN ('PLACED', 'PREPARING', 'READY') ORDER BY orderTime ASC`.
3. **Outlet Menu Retrieval:** `WHERE shopId = $1 AND isAvailable = TRUE`.
4. **Outlet Search & Filtering:** `WHERE status = 'ACTIVE'`.
5. **Admin Dashboard Overview:** `GROUP BY status, paymentMethod, shopId` with `SUM(totalAmount)` and `COUNT(*)`.
6. **Review Retrieval:** `WHERE shopId = $1 ORDER BY createdAt DESC`.
7. **Autobook Schedule Lookup:** `WHERE userId = $1 ORDER BY createdAt DESC`.
*Evidence:* [`docs/evidence/performance/benchmark_summary.md`](file:///D:/Campus%20Bites/docs/evidence/performance/benchmark_summary.md).

---

### 4. Why did you choose those indexes?
**Answer:** In relational databases, B-tree indexes are optimized for equality searches (`=`), range scans (`>`, `<`), and sorting (`ORDER BY`). 
- For the **Staff Active Queue**, the query filters on `shopId` (equality) and `status` (set membership), then sorts by `orderTime`. We created the compound index `[shopId, status]` to allow the database to locate the exact active orders for that stall in a single index lookup.
- For **Menu Retrieval**, food items are always filtered by outlet and whether they are in stock (`WHERE shopId = $1 AND isAvailable = true`). The composite index `[shopId, isAvailable]` allows PostgreSQL to skip sold-out items at the index level without scanning heap pages.
*Code Reference:* [`backend/prisma/schema.prisma:115, 144`](file:///D:/Campus%20Bites/backend/prisma/schema.prisma#L115).

---

### 5. How did you verify that an index was used?
**Answer:** We used PostgreSQL's physical execution plan inspection tool:
```sql
EXPLAIN (ANALYZE, BUFFERS) <QUERY>
```
Rather than assuming an index is used, `EXPLAIN ANALYZE` executes the query and prints the actual execution tree. We verified that the plan changed from `Seq Scan` (Sequential Table Scan) to `Bitmap Index Scan` or `Index Scan` using the specific index name (e.g. `Order_shopId_status_idx`), and checked that `shared hit buffers` decreased.
*Evidence:* [`docs/evidence/performance/explain_plans_raw.md`](file:///D:/Campus%20Bites/docs/evidence/performance/explain_plans_raw.md).

---

### 6. What is the difference between an index and a primary key?
**Answer:** 
- A **Primary Key** is a logical constraint that uniquely identifies each record in a table. By relational database rules, a primary key cannot be null and must be unique.
- An **Index** is an underlying physical data structure (usually a self-balancing B-tree) maintained by the database engine to speed up row retrieval.
- When you define a primary key, PostgreSQL automatically creates a unique B-tree index on that column. However, secondary indexes (like our composite index on `[shopId, status]`) are separate data structures created intentionally by engineers to accelerate specific queries.

---

### 7. Why does the order of columns in a composite index matter?
**Answer:** A composite (compound) B-tree index organizes data hierarchically, ordered first by the first column, then by the second column within matches of the first.
- Think of a telephone directory sorted by `(LastName, FirstName)`. You can quickly find everyone named `"Sharma"` or `"Sharma, Rahul"`. But if you search only for the first name `"Rahul"` without knowing the last name, the directory is useless and you have to read the entire book from page 1.
- In `[shopId, status]`, PostgreSQL first seeks to `shopId = 5`, and then within stall 5's entries, filters by `status IN ('PLACED', 'PREPARING', 'READY')`. Reversing the order to `[status, shopId]` would be less efficient because statuses have low selectivity (thousands of orders share `COMPLETED`).

---

### 8. Can indexes make some operations slower?
**Answer:** Yes! This is a fundamental engineering trade-off. 
Every time an `INSERT`, `UPDATE`, or `DELETE` statement occurs, the database engine must not only update the table's heap storage, but must also rebalance and write to every index associated with that table. 
Adding too many indexes increases disk storage and slows down write operations. Therefore, indexes must be strictly justified by query frequency and measured read latency benefits.

---

### 9. What is EXPLAIN ANALYZE?
**Answer:** 
- `EXPLAIN` asks the PostgreSQL query optimizer to display its predicted execution plan, cost estimates, and access methods without actually running the query.
- `EXPLAIN ANALYZE` actually executes the query against the database, records the real execution time, row counts, memory usage, and with `BUFFERS`, counts the number of 8KB memory pages read from cache (`shared hit`) or disk (`shared read`).

---

### 10. What does the execution plan show?
**Answer:** The execution plan displays a hierarchical tree of relational algebra operations:
1. **Access Method:** How rows are retrieved (`Seq Scan`, `Index Scan`, or `Bitmap Heap Scan`).
2. **Filter & Recheck Conditions:** Which conditions were evaluated at the index level vs. table level.
3. **Sort Method & Memory:** Whether an in-memory quicksort (`quicksort Memory: 26kB`) or external disk merge sort was required.
4. **Cost & Timing:** Estimated cost (`cost=min..max`) and actual execution time in milliseconds (`actual time=start..end`).
5. **Loops & Rows:** Number of executions and actual rows returned.

---

### 11. How many rows were in your benchmark dataset?
**Answer:** The benchmark dataset generated by our deterministic generator (`backend/scripts/benchmark/seed-benchmark.ts`) contained:
- **551 Users** (Students, Staff, Owners, Admins)
- **11 Outlets** (Food stalls and campus cafeterias)
- **89 Food Catalog Items**
- **2,645 Orders** (spanning a 30-day timeline with lunch and dinner rush peaks)
- **5,208 Order Items** (1–3 items per order)
- **650 Customer Reviews**
- **154 Autobook Recurring Schedules**
*Evidence:* [`docs/benchmark-results/query-benchmarks.csv`](file:///D:/Campus%20Bites/docs/benchmark-results/query-benchmarks.csv).

---

### 12. How many times did you execute each benchmark?
**Answer:** We executed **15 iterations per query** for both the baseline stage and the optimized stage, yielding **182 measured data points**. 
Executing multiple runs is critical in performance engineering because single-run measurements are susceptible to cold-cache penalties, network jitter, and database CPU spikes. We evaluated both the **median** ($p50$) and 95th percentile ($p95$).
*Evidence:* [`docs/evidence/performance/benchmark_summary.md`](file:///D:/Campus%20Bites/docs/evidence/performance/benchmark_summary.md).

---

### 13. How did you calculate the percentage improvement?
**Answer:** We used the standard mathematical formula for execution time reduction:
$$\text{Percentage Time Reduction} = \left( \frac{T_{\text{baseline}} - T_{\text{optimized}}}{T_{\text{baseline}}} \right) \times 100$$
For example, in the Admin Overview query:
$$\text{Percentage Reduction} = \left( \frac{3,585.43 - 136.31}{3,585.43} \right) \times 100 = 96.20\%$$
The speedup factor is:
$$\text{Speedup} = \frac{T_{\text{baseline}}}{T_{\text{optimized}}} = \frac{3,585.43}{136.31} = 26.30\times$$

---

### 14. Did you compare equivalent queries and datasets?
**Answer:** Yes. The exact same database instance, the exact same synthetic dataset (seeded with deterministic random seed `424242`), and the exact same input parameters (e.g. `customerId = 340`, `shopId = 5`) were used for both the baseline and optimized benchmark runs.

---

### 15. What happens if the table is too small for an index to help?
**Answer:** If a table contains only a few rows (e.g., our `Area` table with 3 rows or `Category` with 6 rows), reading a table sequentially is actually faster than reading an index page and then reading the table heap page. 
Furthermore, as demonstrated in our Review retrieval and Autobook benchmark queries (where tables had only 150–650 rows), network roundtrip latency from our local test machine to Supabase Singapore (~180–220ms base ping) completely dominated the execution time, resulting in negligible latency differences ($\pm 10$ms). We documented this negative/neutral result honestly in our report.

---

### 16. How did you check that query results remained correct?
**Answer:** For every optimization, we ran functional assertion tests comparing the result payload of the optimized query against the expected database truth:
1. Checked that `statusCounts` matched the sum of orders in the database.
2. Verified that customer order history returned exactly the customer's orders and no other customer's records.
3. Verified that the staff queue contained only active orders (`PLACED`, `PREPARING`, `READY`).
*Test Script:* [`backend/scripts/admin-tests.ts`](file:///D:/Campus%20Bites/backend/scripts/admin-tests.ts).

---

### 17. How do transactions protect order creation?
**Answer:** Placing an order is not a single database write; it requires multiple dependent operations:
1. Verify menu item existence and price.
2. Create the `Order` record.
3. Create all corresponding `OrderItem` line items.
4. Create the initial `PaymentAttempt` record.
If the database server crashed or lost network connection after step 2, the system would be left with a corrupted, empty order record (charging money for zero items). 
By wrapping these writes inside an atomic `prisma.$transaction([ ... ])`, PostgreSQL guarantees the **Atomicity** property of ACID: either all records are committed together, or if any single write fails, the entire transaction automatically rolls back.
*Code Reference:* [`backend/src/controllers/orderController.ts:107`](file:///D:/Campus%20Bites/backend/src/controllers/orderController.ts#L107).

---

### 18. How do you prevent duplicate orders?
**Answer:** We prevent duplicate orders through a two-tier defense:
1. **Application Layer:** When a client submits an order, it sends an `idempotencyKey` (generated via UUID or combination of user ID, stall, and timestamp). The backend checks if an order with that key already exists; if found, it returns the existing order safely with `{ isDuplicate: true }` without creating a second record.
2. **Database Layer:** The `Order` table contains a unique constraint on `idempotencyKey` (`CREATE UNIQUE INDEX Order_idempotencyKey_key`). Even under concurrent simultaneous clicks hitting two backend servers at the exact same millisecond, PostgreSQL's unique constraint forces the second insert to fail with a unique violation (`P2002`), which our backend catches and handles gracefully.
*Code Reference:* [`backend/src/controllers/orderController.ts:42`](file:///D:/Campus%20Bites/backend/src/controllers/orderController.ts#L42).

---

### 19. How is connection pooling configured?
**Answer:** 
- The backend connects to Supabase's hosted **PgBouncer** connection pooler.
- In `backend/.env`, we explicitly configured `connection_limit=7` on Prisma Client:
  `DATABASE_URL="postgresql://...pooler.supabase.com:5432/postgres?connection_limit=7"`
- This ensures that multiple Node.js instances do not overwhelm the Supabase pooler ceiling (`pool_size 15`), preventing connection rejection errors while multiplexing hundreds of incoming HTTP requests.
*Evidence:* [`docs/evidence/cloud/connection_pooling_analysis.md`](file:///D:/Campus%20Bites/docs/evidence/cloud/connection_pooling_analysis.md).

---

### 20. What are the remaining database limitations?
**Answer:**
1. **Single-Region Latency:** The Supabase PostgreSQL database is physically hosted in AWS Singapore (`ap-southeast-1`). Requests originating from India experience ~180–220ms base network roundtrip latency.
2. **No Redis Read-Cache:** Frequently read static data (like the list of campus food stalls and menu categories) is fetched from PostgreSQL on every page load rather than being served from an in-memory Redis cache.
3. **Session vs Transaction Pooler:** The runtime application currently connects via PgBouncer's session mode (port 5432). Moving to transaction mode (port 6543) will support $1,000+$ concurrent users, but requires disabling prepared statements in Prisma.

---

# SECTION 2: CLOUD INFRASTRUCTURE & SCALABILITY QUESTIONS

### 21. What cloud components does the application actually use?
**Answer:** 
1. **Frontend Hosting:** React Single Page Application (SPA) built with Vite, designed for edge delivery on Vercel or Cloudflare Pages CDN.
2. **Backend Compute:** Express.js 5 application running on Node.js 20 LTS container runtime (Render / Railway).
3. **Database Cloud:** Managed PostgreSQL 15.8 on Supabase cloud infrastructure hosted in AWS Region `ap-southeast-1` (Singapore) with built-in PgBouncer pooling.
4. **Autonomous Scheduler:** In-process Node.js background worker executing every 60 seconds with database-level atomic job locking.
*Evidence:* [`docs/evidence/cloud/cloud_architecture.md`](file:///D:/Campus%20Bites/docs/evidence/cloud/cloud_architecture.md).

---

### 22. How does a request travel from the frontend to the database?
**Answer:**
1. **User Action:** The student clicks "Place Order" in the browser.
2. **Frontend Interceptor:** The React Axios service attaches the JWT bearer token from memory and sets `Content-Type: application/json`.
3. **TLS Termination & Edge:** The request reaches the cloud reverse proxy (HTTPS on port 443), terminating TLS encryption.
4. **Security Middleware:** In Node.js, `helmet()` injects security headers, `cors()` verifies the origin against our allowlist, and `express.json({ limit: '50kb' })` prevents payload denial-of-service attacks.
5. **Auth & Rate Limiting:** `authLimiter` checks the IP request bucket; `authenticateToken` validates the JWT signature using `HS256`.
6. **Controller & Business Logic:** `orderController` verifies item availability, re-calculates prices from the DB, and begins a transaction.
7. **Connection Pool:** Prisma Client acquires an idle TCP connection from the PgBouncer pooler.
8. **PostgreSQL Execution:** PostgreSQL executes the SQL commands, enforces foreign keys and unique constraints, commits the transaction, and returns the data.

---

### 23. How did you configure the deployment?
**Answer:** We implemented reproducible deployment scripts in `backend/package.json`:
- `npm run build`: Generates Prisma Client (`prisma generate`) and compiles TypeScript (`tsc`) with 0 errors.
- `npm run migrate:deploy`: Runs `prisma migrate deploy` to apply pending migrations during CI/CD before starting the server.
- `npm start`: Starts the compiled production server `node dist/app.js`.
- Configured `.env.example` templates with placeholders and strict Zod validation in `backend/src/config/env.ts` to ensure the server fails safely on startup if production secrets are missing.
*Evidence:* [`docs/DEPLOYMENT.md`](file:///D:/Campus%20Bites/docs/DEPLOYMENT.md).

---

### 24. How do you handle environment variables and secrets?
**Answer:**
- **Zero Secrets in Code:** All real `.env` files are strictly added to `.gitignore`. No database passwords or JWT secrets appear in Git history.
- **Fail-Safe Startup:** Using Zod in `backend/src/config/env.ts`, the backend validates required variables at startup. If `JWT_SECRET` is less than 32 characters or `DATABASE_URL` is omitted in production, the application terminates immediately with a clear error rather than starting in an insecure state.
- **Client Bundle Isolation:** Only variables prefixed with `VITE_` are exposed to the browser bundle (e.g. `VITE_API_URL`). Database connection strings and JWT signing keys remain exclusively on the server.
*Evidence:* [`docs/ENVIRONMENT_VARIABLES.md`](file:///D:/Campus%20Bites/docs/ENVIRONMENT_VARIABLES.md).

---

### 25. How do you verify that the database is reachable?
**Answer:** Through our dedicated readiness probe endpoint:
```http
GET /health/ready
```
When invoked, the backend executes a lightweight query: `SELECT 1` via `prisma.$queryRaw`. 
- If the database responds, it returns HTTP 200 with `{ status: "ok", database: "connected" }`.
- If the database is unreachable, it catches the error and returns HTTP 503 Service Unavailable with `{ status: "error", database: "disconnected" }`, without leaking credentials or internal stack traces to clients.
*Code Reference:* [`backend/src/app.ts:50`](file:///D:/Campus%20Bites/backend/src/app.ts#L50).

---

### 26. How do health checks work?
**Answer:** We implemented standardized Kubernetes/cloud-compatible health probes:
1. **Liveness Probe (`GET /health` and `GET /health/live`):** Verifies that the Node.js event loop and HTTP server are responsive. Cloud orchestrators (like Render or Docker) use this to restart containers that freeze or dead-lock.
2. **Readiness Probe (`GET /health/ready`):** Verifies that external dependencies (specifically PostgreSQL connectivity) are active. Load balancers use this to route traffic away from backend instances during database maintenance.

---

### 27. How does Autobook execute when the user's browser is closed?
**Answer:** 
In earlier flawed versions, recurring orders depended on browser timers (`setInterval` in React), which stopped working the moment the student closed their laptop or browser tab.
We completely replaced that architecture with an **Autonomous Backend Scheduler** (`backend/src/services/autobookScheduler.ts`). The scheduler runs inside the backend server process on a 60-second interval:
1. It queries `AutobookSchedule` where `isActive = true` and `scheduledTime` matches the server clock.
2. It claims the job atomically using a database update.
3. It creates the order and payment records directly on the server.
The user does not need to have the web application open or be logged in for their order to be executed.
*Code Reference:* [`backend/src/services/autobookScheduler.ts:15`](file:///D:/Campus%20Bites/backend/src/services/autobookScheduler.ts#L15).

---

### 28. What happens if the background worker restarts?
**Answer:** 
The scheduler is stateless and database-backed:
- When the server restarts, the worker initializes immediately and runs an initial sweep.
- Because schedules and execution histories are stored in the database (`AutobookSchedule` and `AutobookExecutionLog`), no schedule state is lost in memory.
- If a schedule became due while the worker was offline, the next execution sweep detects that `lastRunDate` was not updated for today and executes the overdue order immediately.
*Evidence:* [`docs/AUTOBOOK_ARCHITECTURE.md`](file:///D:/Campus%20Bites/docs/AUTOBOOK_ARCHITECTURE.md).

---

### 29. How did you test concurrent users?
**Answer:** We built a dedicated concurrency load test harness: `backend/scripts/load-tests/realistic-load.ts`.
- Simulates 8 concurrent virtual users making 160 randomized requests over 20 seconds.
- Simulates a realistic lunch rush: 30% stall browsing, 25% menu browsing, 20% order placement, 15% kitchen queue polling, and 10% autobook schedule queries.
- Measured throughput (req/sec), median latency, p95 latency, and verified zero database connection timeouts.
*Evidence:* [`docs/evidence/performance/load_test_results.md`](file:///D:/Campus%20Bites/docs/evidence/performance/load_test_results.md).

---

### 30. What is the highest workload you actually tested?
**Answer:** We successfully tested **8 concurrent virtual users generating 160 requests at 7.82 requests per second** over a 20.46-second test window with **0.00% error rate** and a median response time of **403.8 ms**.
*Honest Engineering Limitation:* We do not claim the system supports 10,000 users because we have not tested 10,000 users. In an academic audit, claiming untested capacities is fraudulent.

---

### 31. How did you measure response time and error rate?
**Answer:** 
- In the load testing harness, we used high-resolution timestamps (`performance.now()`) to measure the exact millisecond delta between dispatching an HTTP request and receiving the full response.
- Response times were stored in an array and mathematically sorted to determine the median ($p50$) and 95th percentile ($p95$).
- Any response returning HTTP status $\ge 400$ or throwing a network timeout was recorded as an error. Error rate was calculated as:
$$\text{Error Rate} = \left( \frac{\text{Failed Requests}}{\text{Total Requests}} \right) \times 100$$
Our load test recorded 0 failed requests out of 160, yielding **0.00% error rate**.

---

### 32. How do you prevent database connection exhaustion?
**Answer:**
1. **Connection Multiplexing:** We route queries through PgBouncer rather than connecting directly to PostgreSQL backend processes.
2. **Client-Side Cap:** In Prisma Client, we capped connections to `connection_limit=7`.
3. **Short-Lived Transactions:** We avoid long-running transactions. All order placements use optimized batch queries (`findMany`) to fetch all items in a single round-trip, keeping the database transaction open for less than 15 milliseconds.

---

### 33. What happens if the database becomes unavailable?
**Answer:**
1. The readiness probe (`GET /health/ready`) immediately returns HTTP 503, alerting load balancers.
2. Express controllers catch Prisma database connection errors gracefully and return standardized JSON error messages:
   `{ "error": "Database service temporarily unavailable. Please retry shortly." }`
3. Stack traces and internal database hostnames are stripped by our centralized error handling middleware in `backend/src/app.ts`, preventing information leakage.

---

### 34. How are backups taken and restored?
**Answer:**
1. **Automated Cloud Backups:** Supabase managed infrastructure takes daily automated snapshots with 7-day retention and continuous Write-Ahead Log (WAL) archiving for Point-in-Time Recovery (PITR).
2. **Logical Backups (`pg_dump`):** Documented a manual runbook using `pg_dump --format=custom` to generate compressed, encrypted portable database dumps.
3. **Restoration Runbook (`pg_restore`):** Documented the restoration procedure into an isolated staging database followed by verification using `npx tsx scripts/verify-db.ts`. We explicitly did NOT overwrite production data during this audit to preserve data safety.
*Evidence:* [`docs/evidence/reliability/backup_runbook.md`](file:///D:/Campus%20Bites/docs/evidence/reliability/backup_runbook.md).

---

### 35. What cloud costs are known, and which are only estimates?
**Answer:**
- **Current Development / Staging:** **$0.00 / month**. Running on Vercel Free Tier, Render Free Web Service, and Supabase Free Tier.
- **Production Pilot (Single Campus):** **Estimated at ~$32.00 / month** ($7/mo Render Starter container for 24/7 uptime without sleep + $25/mo Supabase Pro for automated daily backups and 7-day PITR).
- We explicitly labeled our cost analysis as an **ESTIMATE** because no production credit card or cloud billing invoices were incurred during this academic project phase.
*Evidence:* [`docs/evidence/cloud/cost_model.md`](file:///D:/Campus%20Bites/docs/evidence/cloud/cost_model.md).

---

### 36. What are the remaining deployment limitations?
**Answer:**
1. **Simulated Payment Gateway:** The payment workflow is an architectural simulation sandbox (`isSimulated: true`); real credit card and UPI processing via Razorpay/Stripe was intentionally deferred.
2. **Single Server Worker:** The Autobook background scheduler currently runs inside the Express process. In a horizontally scaled multi-container deployment, migrating to an external durable distributed queue (like BullMQ with Redis) is recommended to prevent multi-container scheduler overlap.

---

# SECTION 3: CRITICAL THINKING & ACADEMIC DEFENSE

### 37. Which optimization produced the largest measured benefit?
**Answer:** 
The **Admin Dashboard Database-Side Aggregation** (`adminController.ts`). 
Moving from in-memory JavaScript array iteration of 2,645 orders to native PostgreSQL `HashAggregate` reduced execution latency from **3,585 ms to 136 ms** (**26.3x faster**, 96.2% time reduction) and eliminated a 30MB process memory bloat per request.

---

### 38. Which attempted optimization did not help?
**Answer:** 
Adding composite indexes on the **Review** table (`[shopId, createdAt DESC]`) and **AutobookSchedule** table (`[userId, createdAt DESC]`). 
Because these tables had relatively small row counts (650 and 154 rows respectively), PostgreSQL was already able to read the entire table into a few 8KB memory buffers. The network roundtrip from our local machine to Supabase Singapore (~180–220ms base ping) dominated the request time, so adding an index produced a negligible difference ($\pm 10$ms). This is a valuable academic finding: **indexing cannot overcome network latency on small tables**.

---

### 39. What evidence supports the final conclusion?
**Answer:** 
Our conclusion is supported by reproducible, verifiable evidence across the repository:
1. **92 / 92 automated tests passing** across 6 distinct test suites (`test:db`, `test:security`, `test:order-autobook`, `test:admin`, `test:mock-integrity`, `test:acceptance`).
2. **182 raw PostgreSQL execution data points** recorded in `docs/benchmark-results/query-benchmarks.csv`.
3. **160 load testing requests** executed at 7.82 req/sec with 0.00% error rate.
4. **0 npm audit vulnerabilities** across all dependencies.
5. **Clean TypeScript compilation (0 errors)** on both frontend and backend production builds.

---

### 40. What would you improve next, and why?
**Answer:**
1. **Deploy in AWS Region `ap-south-1` (Mumbai):** Moving the PostgreSQL database from Singapore to Mumbai would reduce base network roundtrip ping from 190ms to under 25ms, immediately cutting all API latencies in half for campus users in India.
2. **Implement Redis Caching:** Cache the outlet directory (`GET /api/shops`) and static menus in an in-memory Redis cluster with a 5-minute TTL and cache invalidation on owner menu updates.
3. **Real Payment Gateway Integration:** Connect the existing webhook signature interface (`POST /api/orders/webhook/payment`) to Razorpay or Stripe test sandboxes.
