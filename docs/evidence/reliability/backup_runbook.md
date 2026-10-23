# Database Backup & Disaster Recovery Runbook

## 1. Backup Strategy Overview

| Tier | Backup Mechanism | Frequency | Retention | Recovery Point Objective (RPO) | Recovery Time Objective (RTO) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Tier 1 (Staging / Free)** | Logical Backups (`pg_dump`) | Manual / Daily | 30 Days | 24 Hours | 30 Minutes |
| **Tier 2 (Production Supabase Pro)** | Automated Snapshots + Physical WAL Archiving | Continuous (Every 2–5 min) | 7 Days | < 5 Minutes | < 15 Minutes |

---

## 2. Logical Backup Procedure (`pg_dump`)

To take an encrypted, portable snapshot of the PostgreSQL database:
```bash
# Export schema and data into custom compressed format
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --verbose \
  --dbname="$DIRECT_URL" \
  --file="backup_campus_bites_$(date +%Y%m%d_%H%M%S).dump"
```

---

## 3. Restoration Runbook (`pg_restore`)

> [!CAUTION]
> Never restore a backup directly over active production data. Always restore into an isolated staging database first to verify table counts and integrity.

1. Provision an isolated target database.
2. Restore using `pg_restore`:
   ```bash
   pg_restore \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     --verbose \
     --dbname="$TARGET_DATABASE_URL" \
     "backup_campus_bites_20261024_000000.dump"
   ```
3. Run schema verification tests to validate database integrity:
   ```bash
   cd backend
   npx tsx scripts/verify-db.ts
   ```
4. Verify table row counts against the backup manifest.
