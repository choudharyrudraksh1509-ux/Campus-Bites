# Cloud Infrastructure & Network Architecture

## 1. Cloud Component Topology

```mermaid
flowchart TD
    subgraph Clients["User Tier"]
        StudentClient["Student Web App<br/>(React / Vite SPA)"]
        KitchenClient["Kitchen Display Terminal<br/>(React / Vite SPA)"]
        AdminClient["Admin Web Console<br/>(React / Vite SPA)"]
    end

    subgraph CDN["Edge & Content Delivery Layer"]
        VercelCDN["Vercel Edge Network / Cloudflare<br/>Global Anycast CDN<br/>Automatic Brotli & Gzip"]
        TLSTerm["TLS 1.3 Termination<br/>(HTTPS :443)"]
    end

    subgraph Compute["Application Compute Layer"]
        RenderService["Render Web Service / Container<br/>Node.js 20 LTS Runtime<br/>Express 5.2.1 Application"]
        HealthProbes["Health Probes<br/>/health (Liveness)<br/>/health/ready (Readiness)"]
        RateLimiter["express-rate-limit<br/>IP Memory Buckets"]
    end

    subgraph Database["Database & Storage Layer"]
        PgBouncer["PgBouncer Connection Pooler<br/>Supabase AWS Region ap-southeast-1<br/>Port 6543 (Tx) / Port 5432 (Session)"]
        PostgresDB[("PostgreSQL 15.8 Database<br/>Encrypted Storage (AES-256)<br/>Continuous WAL Archiving")]
    end

    StudentClient --> VercelCDN
    KitchenClient --> VercelCDN
    AdminClient --> VercelCDN
    VercelCDN --> TLSTerm
    TLSTerm --> RenderService
    RenderService --> RateLimiter
    RenderService --> HealthProbes
    RenderService -->|Prisma Client TCP| PgBouncer
    PgBouncer -->|Managed Connection Pool| PostgresDB
```

---

## 2. Cloud Components Inventory & Verification Status

| Component | Target Provider | Configuration Location | Verification Status | Operational Behavior |
| :--- | :--- | :--- | :---: | :--- |
| **Frontend SPA** | Vercel / Cloudflare Pages | `frontend/vite.config.ts`, `frontend/package.json` | **VERIFIED (Local & Build)** | Compiles to static bundle in `dist/`. No server secrets leaked. |
| **Backend API** | Render / Railway / Docker | `backend/package.json`, `backend/src/app.ts` | **VERIFIED (Local & Container)** | Express 5 with Helmet headers, CORS allowlist, and 50KB payload limits. |
| **Managed Database** | Supabase (AWS `ap-southeast-1`) | `backend/prisma/schema.prisma`, `.env` | **VERIFIED (Live Active DB)** | PostgreSQL 15.8 with PgBouncer connection pooler. |
| **Scheduler** | In-Process Node Background Worker | `backend/src/services/autobookScheduler.ts` | **VERIFIED (Service & Tests)** | 60-second cron runner with database-backed atomic job claiming. |
| **Health Probes** | Backend HTTP Routes | `backend/src/app.ts` (`/health`, `/health/ready`) | **VERIFIED (HTTP 200/503)** | Liveness returns process status; readiness executes `SELECT 1`. |
