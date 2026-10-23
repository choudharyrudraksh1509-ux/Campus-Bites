# Campus Bites - Backup, Disaster Recovery & Restoration Runbook

This document details the database backup strategy, Supabase point-in-time recovery (PITR) architecture, recovery metrics, and step-by-step restoration runbooks for the Campus Bites platform.

---

## 1. Recovery Objectives (RPO & RTO)

| Metric | Target | Definition | Implementation Mechanism |
| :--- | :---: | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 5 Minutes** | Maximum acceptable data loss window during a disaster. | Continuous Write-Ahead Log (WAL) archiving via Supabase physical streaming. |
| **RTO (Recovery Time Objective)** | **< 30 Minutes** | Maximum allowable platform downtime to restore operational state. | Automated snapshot restoration and fast container restart runbooks. |

---

## 2. Backup Architecture & Strategy

```mermaid
flowchart TD
    LiveDB[("Live PostgreSQL Database\n(Campus Bites)")]
    WAL["Write-Ahead Logs (WAL)\n(Continuous Streaming)"]
    DailySnapshot["Automated Daily Base Backup\n(Retained 7 - 30 Days)"]
    OffsiteStorage[("Encrypted Cloud Object Storage\n(AWS S3 / Supabase Backup Store)")]

    LiveDB -->|"Every Transaction"| WAL
    LiveDB -->|"Daily at 03:00 UTC"| DailySnapshot
    WAL --> OffsiteStorage
    DailySnapshot --> OffsiteStorage
```

### Layered Protection Strategy
1. **Automated Daily Snapshots**: Complete physical image of the database taken nightly at 03:00 UTC during off-peak campus hours. Retained for 7 days (or 30 days on Pro plans).
2. **Continuous WAL Streaming (PITR)**: Every transaction write-ahead log is archived continuously to durable offsite object storage. Allows restoring the database to any exact second within the retention window.
3. **Pre-Migration Manual Snapshots**: Before applying any database migration in production, an explicit snapshot is captured via `pg_dump`.

---

## 3. Disaster Scenarios & Recovery Runbooks

---

### Scenario A: Accidental Data Deletion or Schema Corruption (PITR)
*Example: An administrator mistakenly drops or corrupts orders, or an unverified script corrupts catalog records.*

#### Procedure:
1. **Freeze Application Traffic**:
   Immediately take the backend API offline or redirect users to a maintenance notice to stop new transactions:
   ```bash
   # Scale API instances to 0 or enable maintenance mode in load balancer
   ```
2. **Identify Target Timestamp**:
   Determine the exact UTC timestamp immediately prior to the incident (e.g. `2026-10-23T14:15:00Z`).
3. **Execute Point-in-Time Recovery in Supabase**:
   - Navigate to **Supabase Dashboard** -> **Project Settings** -> **Database** -> **Backups**.
   - Select **Point-in-Time Recovery (PITR)**.
   - Enter target timestamp (e.g. `2026-10-23 14:15:00 UTC`).
   - Click **Confirm Restore**.
4. **Run Health & Integrity Verification**:
   Once restore completes, run backend verification tests against the restored instance:
   ```bash
   cd backend
   npm run test:db
   npm run test:acceptance
   ```
5. **Resume Platform Traffic**:
   Restore API containers to active state.

---

### Scenario B: Manual pg_dump / pg_restore Runbook
*Used for local disaster recovery, offline compliance archiving, or cross-cloud migration.*

#### 1. Full Database Export (Backup)
Execute `pg_dump` with custom directory format and maximum compression:
```bash
pg_dump \
  --dbname="postgresql://postgres.xxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --verbose \
  --file="campus_bites_backup_$(date +%Y%m%d_%H%M%S).dump"
```

#### 2. Clean Database Import (Restore)
To restore into a fresh staging or recovery database instance:
```bash
# 1. Drop existing public schema if restoring into fresh target
psql "postgresql://user:pass@recovery-host:5432/postgres" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 2. Restore all tables, constraints, indexes, and data
pg_restore \
  --dbname="postgresql://user:pass@recovery-host:5432/postgres" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  "campus_bites_backup_20261023_180000.dump"

# 3. Synchronize Prisma Migration State
npx prisma migrate status
```

---

## 4. Backup Integrity & Fire-Drill Testing

To ensure backups are never "dark data" that fail during a real emergency:

1. **Automated Weekly Staging Refresh**:
   Every Sunday, the automated CI pipeline restores the latest automated snapshot into the isolated staging database.
2. **Quarterly Disaster Recovery Simulation (Fire-Drill)**:
   The DevOps Lead and QA Lead execute a timed mock restoration to verify:
   - Restoration completes within the **30-minute RTO**.
   - `npm run test:db` passes 100% on the restored database.
   - All user passwords, orders, reviews, and audit logs verify with zero data corruption.
