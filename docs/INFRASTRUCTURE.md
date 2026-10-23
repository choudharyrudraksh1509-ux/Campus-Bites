# Campus Bites - Infrastructure & Network Architecture

This document describes the cloud infrastructure, connection pooling topology, network security hardening, and high availability design of the Campus Bites platform.

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Clients["Clients Layer"]
        StudentDevice["Student Mobile / Web\n(Browser)"]
        KitchenDevice["Kitchen Terminal / Display\n(Browser)"]
        AdminDevice["Admin Laptop\n(Browser)"]
    end

    subgraph Edge["Edge & CDN Layer"]
        CDN["Global Edge CDN / WAF\n(Cloudflare / Vercel Edge)"]
        SSL["TLS 1.3 Termination\n(HTTPS :443)"]
    end

    subgraph Compute["Application Compute Layer"]
        LoadBalancer["Application Load Balancer\n(Reverse Proxy)"]
        NodeApp1["API Container #1\n(Express 5 + Prisma)"]
        NodeApp2["API Container #2\n(Horizontal Replicas)"]
    end

    subgraph Data["Database & Storage Layer"]
        Pooler["Supabase PgBouncer Pooler\n(Port 6543 / 5432)"]
        PrimaryDB[("Primary PostgreSQL 15\n(AWS ap-southeast-1)")]
        WALArchive[("Continuous WAL Archiving\n& Point-in-Time Snapshots")]
    end

    StudentDevice --> CDN
    KitchenDevice --> CDN
    AdminDevice --> CDN
    CDN --> SSL
    SSL --> LoadBalancer
    LoadBalancer --> NodeApp1
    LoadBalancer --> NodeApp2
    NodeApp1 --> Pooler
    NodeApp2 --> Pooler
    Pooler --> PrimaryDB
    PrimaryDB --> WALArchive
```

---

## 2. Database Connection Pooling Topology

PostgreSQL allocates a dedicated backend worker process for every direct TCP connection, consuming approximately 10MB of RAM per connection. Under campus mealtime rushes, hundreds of concurrent student clients can exhaust database memory without connection pooling.

### Pooler Modes Comparison

| Configuration | Port | Pooler Mode | Concurrency Capacity | Use Case in Campus Bites |
| :--- | :---: | :---: | :---: | :--- |
| **Direct / Session Mode** | `5432` | Session | Max 15 sessions total | **Prisma Migrations Only** (`DIRECT_URL`). Required for DDL schema altering and advisory locking. |
| **PgBouncer Transaction Mode** | `6543` | Transaction | Hundreds of concurrent clients | **Runtime REST API Queries** (`DATABASE_URL`). Connection released back to pool immediately after transaction/query completes. |

### Prisma Engine Connection Tuning
In `backend/.env`:
```bash
# Production Runtime Connection String (Transaction Mode):
DATABASE_URL="postgresql://postgres.xxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15"

# Direct Connection String (DDL Migrations Only):
DIRECT_URL="postgresql://postgres.xxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

### Interactive Transaction Timeout Tuning
To prevent transaction cancellation during cross-region latency spikes:
```typescript
await prisma.$transaction(async (tx) => {
    // Transactional queries
}, {
    maxWait: 10000, // Maximum time Prisma Client waits to acquire connection (10s)
    timeout: 30000  // Maximum time the interactive transaction can run (30s)
});
```

---

## 3. Network Security & Hardening Controls

### A. HTTP Security Headers (Helmet)
Express integrates `helmet()` on all incoming requests to inject defensive headers:
- `Strict-Transport-Security`: Enforces HTTPS for 1 year (`max-age=31536000; includeSubDomains`).
- `X-Content-Type-Options`: Set to `nosniff` to prevent MIME-sniffing attacks.
- `X-Frame-Options`: Set to `SAMEORIGIN` to defeat clickjacking attacks.
- `X-XSS-Protection`: Legacy filter enabled.
- `Content-Security-Policy`: Restricts unauthorized script injection.

### B. Environment-Based CORS Enforcement
The API enforces an origin allowlist:
- Non-browser requests (e.g. mobile native clients, curl health probes) with no origin header are permitted.
- Browser requests from unauthorized origins return `HTTP 403 Forbidden: CORS request rejected`.
- Permitted origins in production: `https://app.campusbites.edu`.

### C. DoS Payload Size Limiting
Request bodies are strictly capped at **50 Kilobytes**:
```typescript
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
```
Any oversized JSON payload immediately receives `HTTP 413 Payload Too Large` without consuming server memory.

### D. Layered Rate Limiters (`express-rate-limit`)

| Limiter | Target Routes | Threshold | Protection Purpose |
| :--- | :--- | :--- | :--- |
| **`authLimiter`** | `/api/auth/*` | 30 requests / 15 min | Prevents brute-force credential stuffing and password guessing. |
| **`orderLimiter`** | `POST /api/orders` | 20 requests / 1 min | Prevents automated order flooding and inventory locking. |
| **`reviewLimiter`** | `POST /api/reviews` | 15 requests / 15 min | Prevents reputation spam and rating manipulation. |
| **`generalLimiter`** | `/api/*` | 400 requests / 15 min | Guards overall platform compute and database resources. |

---

## 4. High Availability & Fault Tolerance

1. **Stateless API Architecture**: All user sessions are authenticated via self-contained HMAC-SHA256 JWT tokens. Node.js backend instances carry zero session state and can be scaled horizontally behind an Application Load Balancer.
2. **Automated Health Probes**:
   - Process Liveness (`GET /health`): Verified in < 1ms. Fails only if the Node event loop is blocked.
   - Database Readiness (`GET /health/ready`): Executes `SELECT 1` against PostgreSQL. Returns `HTTP 503` if database is unreachable, temporarily pulling the unhealthy container from traffic.
3. **Database Redundancy**: Managed Supabase PostgreSQL is hosted in AWS Multi-AZ infrastructure with continuous WAL archiving and automated failover.
