# Cloud Infrastructure Cost Model & Estimation

**Audit Scope:** Transparent infrastructure cost analysis. No actual billing invoices are available in the public repository; this analysis provides a rigorously estimated operational cost model labeled **ESTIMATE**.

---

## 1. Multi-Tier Cost Breakdown

| Operational Tier | Frontend (Vercel) | Backend Compute (Render) | Database (Supabase) | Monitoring / CI | Estimated Monthly Total | Target Concurrency |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **Tier 1: Free / Hobby (Current Staging)** | **$0.00** (Free Tier)<br>100GB edge bandwidth | **$0.00** (Free Tier)<br>512MB RAM, sleeps on idle | **$0.00** (Free Tier)<br>500MB DB, 2 projects, shared vCPU | **$0.00** (GitHub Actions public) | **$0.00 / month** | $\le 10$ concurrent students (testing) |
| **Tier 2: Production Pilot (Single Campus)** | **$0.00** (Vercel Hobby) | **$7.00** (Render Starter)<br>512MB RAM, 24/7 uptime, no sleep | **$25.00** (Supabase Pro)<br>8GB DB, 250GB bandwidth, daily backups, 7-day PITR | **$0.00** (Included logs) | **$32.00 / month** | $\le 100$ concurrent students |
| **Tier 3: Multi-Campus Scale (Production)** | **$20.00** (Vercel Pro)<br>1TB bandwidth, team access | **$50.00** (Render Standard x 2)<br>2GB RAM, 2 CPU cores, load balanced | **$60.00** (Supabase Pro + Compute Add-on)<br>2 vCPU, 8GB RAM, 100 connection pool | **$15.00** (BetterUptime / Datadog) | **$145.00 / month** | $\le 1,000+$ concurrent students |

---

## 2. Cost Trade-Offs & Economic Analysis
1. **Database-Side Aggregation Cost Savings:**  
   Moving aggregation from Node.js memory into PostgreSQL saved over 30MB of RAM per request in Node.js. This enables the backend to run on a $7/month Render Starter instance rather than requiring an upgraded $25–$50/month container instance.
2. **Connection Pooling Savings:**  
   PgBouncer eliminates the need for a dedicated high-memory database server. A standard micro/small RDS instance on AWS costs ~$45/month; Supabase managed PgBouncer achieves the same concurrency at half the baseline operational cost.
