# Connection Pooling Analysis & Configuration

## 1. The Engineering Challenge of Connection Pooling
In PostgreSQL, each incoming TCP client connection spawns a dedicated backend process, consuming approximately 10MB of RAM per connection. Under campus dining rush periods, hundreds of student browser sessions making simultaneous requests would quickly exhaust database memory and hit connection limits (`too many connections for role`).

To mitigate this, Campus Bites utilizes **PgBouncer**, a lightweight connection pooler hosted alongside the Supabase PostgreSQL database.

---

## 2. PgBouncer Modes: Session vs Transaction Pooling

| Feature | Session Pooling (`port 5432`) | Transaction Pooling (`port 6543`) |
| :--- | :--- | :--- |
| **Connection Binding** | A client connection holds a server connection for the entire duration of the client session. | A server connection is held only for the duration of a single SQL transaction block (`BEGIN ... COMMIT`). |
| **Concurrency Multiplier** | Limited (1 client connection per server connection). | High ($100+$ client connections multiplexed over $10$ server connections). |
| **Prisma Compatibility** | Fully compatible with all Prisma features, prepared statements, and schema migrations (`prisma migrate deploy`). | Requires `pgbouncer=true` parameter in Prisma connection string; disables prepared statements. |
| **Port in Campus Bites** | Configured as `DIRECT_URL` (Port 5432) for running migrations. | Configured as `DATABASE_URL` (Port 6543) for runtime web traffic. |

---

## 3. Active Runtime Pool Configuration
In `backend/.env`:
```env
DATABASE_URL=postgresql://postgres.xxx:xxx@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?connection_limit=7
DIRECT_URL=postgresql://postgres.xxx:xxx@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

### Why `connection_limit=7`?
Supabase Free/Starter tier poolers enforce a maximum concurrent pool size of 15 connections (`EMAXCONNSESSION: pool_size 15`). 
Setting `connection_limit=7` on Prisma Client guarantees that:
1. Two horizontal backend instances (e.g. 2 replicas on Render/Railway) consume at most $7 \times 2 = 14$ connections.
2. 1 connection remains available for administrative migrations or emergency debugging.
3. Node.js queues excess queries in application memory rather than overwhelming the PostgreSQL pooler with TCP connection rejection errors.
