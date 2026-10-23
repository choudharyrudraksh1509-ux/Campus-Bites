# Campus Bites - Environment Variables Reference Guide

This document defines the configuration dictionary, security standards, defaults, and validation rules for all environment variables used across the Campus Bites backend and frontend services.

---

## 1. Backend Environment Variables (`backend/.env`)

All backend variables are authoritatively validated on application startup via Zod in `backend/src/config/env.ts`. If any required variable is missing or malformed, the process terminates immediately with an explicit error.

| Variable Name | Type | Required | Default | Allowed Envs | Description & Security Policy |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`PORT`** | `Number` | No | `5000` | Dev, Staging, Prod | The TCP port Express listens on. Typically injected automatically by cloud hosts (e.g. Render, Railway). |
| **`NODE_ENV`** | `String` | No | `'development'` | Dev, Staging, Prod, Test | Execution environment mode: `'development'`, `'production'`, or `'test'`. In production, suppresses stack traces and enforces strict security. |
| **`JWT_SECRET`** | `String` | **Yes** | *None* | Dev, Staging, Prod | **Critical Secret**. Used to sign and verify HMAC-SHA256 JWT auth tokens. Must be high-entropy and ≥ 32 characters in production. Never commit to source control. |
| **`DATABASE_URL`** | `String` | **Yes** | *None* | Dev, Staging, Prod | PostgreSQL connection string with connection pool parameters (`?connection_limit=7`). Used for all runtime application queries. |
| **`DIRECT_URL`** | `String` | **Yes** | *None* | Dev, Staging, Prod | Direct unpooled PostgreSQL connection string (Port 5432). Required by Prisma for DDL migrations (`prisma migrate deploy`) and advisory locking. |
| **`SUPABASE_URL`** | `String` | No | *None* | Dev, Staging, Prod | HTTPS endpoint of the Supabase project instance (e.g. `https://xxx.supabase.co`). |
| **`SUPABASE_ANON_KEY`** | `String` | No | *None* | Dev, Staging, Prod | Public anonymous JWT key for Supabase client initialization and realtime channels. |
| **`ALLOWED_ORIGINS`** | `String` | No | `http://localhost:5173` | Dev, Staging, Prod | Comma-delimited list of allowed client browser origins for CORS enforcement. In production, set to `https://app.campusbites.edu`. |
| **`DISABLE_RATE_LIMIT`** | `Boolean` | No | `false` | Staging, Test | Test flag. When set to `'true'`, bypasses rate limiters to permit automated load benchmarking. **Strictly prohibited in production**. |
| **`AUTO_SEED`** | `Boolean` | No | `false` | Dev, Staging | Guard flag. When `'true'` in development, seeds initial stalls and staff accounts if database is empty. Disabled in production. |

---

## 2. Frontend Environment Variables (`frontend/.env`)

Vite bundles client variables prefixed with `VITE_` into client-side JavaScript. **Never place sensitive private keys or database passwords in frontend environment files.**

| Variable Name | Type | Required | Default | Allowed Envs | Description |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`VITE_API_BASE_URL`** | `String` | No | `/api` | Dev, Staging, Prod | Base URL path for all backend REST API calls made by Axios. In production, set to `https://api.campusbites.edu/api`. |
| **`VITE_SUPABASE_URL`** | `String` | No | *None* | Dev, Staging, Prod | Public Supabase project URL for realtime order tracking subscriptions. |
| **`VITE_SUPABASE_ANON_KEY`** | `String` | No | *None* | Dev, Staging, Prod | Public anonymous key for client-side Supabase subscription initialization. |

---

## 3. Strict Validation Schema (`backend/src/config/env.ts`)

The backend parses variables using Zod:

```typescript
const envSchema = z.object({
  PORT: z.string().default('5000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL'),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid connection URL').optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  DISABLE_RATE_LIMIT: z.string().optional(),
  AUTO_SEED: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production' && data.JWT_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JWT_SECRET must be at least 32 characters in production',
      path: ['JWT_SECRET']
    });
  }
});
```

---

## 4. Secret Rotation & Security Invariants

1. **Zero Secret Leakage in Logs**: Database URLs and JWT secrets must never appear in error logs, console statements, or unhandled rejection dumps.
2. **Scheduled Secret Rotation**:
   - `JWT_SECRET`: Rotate every 90 days. To rotate gracefully without logging out all users immediately, support dual-key verification during a 24-hour overlap window.
   - Database Passwords: Change every 180 days via Supabase Database Settings, followed by updating backend hosting environment variables.
3. **Environment Segregation**: Staging and Production **must never share database instances or credentials**. Staging uses an independent Supabase project or isolated schema.
