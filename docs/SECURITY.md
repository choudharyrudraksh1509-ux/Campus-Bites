# Campus Bites: Application Security Review & Hardening Report

**Document Version:** 1.0.0  
**Status:** Hardened, Verified, and Tested  
**Date:** October 23, 2026  
**Auditor / Engineer:** Senior Application Security Engineer & Full-Stack Architect  
**Scope:** Vulnerability remediation, authentication and authorization hardening, input validation, API defenses, secret management, secret-rotation checklist, and automated security regression testing.

---

## 1. Executive Security Summary

During an exhaustive application security review of Campus Bites, multiple critical vulnerabilities were identified across authentication, authorization, business logic, and configuration tiers. 

All identified vulnerabilities have been remediated in source code without breaking legitimate application functionality. The application now implements defense-in-depth across the HTTP request lifecycle, enforces strict role-based and stall-level authorization, rejects client price manipulation, eliminates authentication bypass backdoors, applies security headers and rate limits, and validates all inputs using Zod.

### Verification Status
- **Automated Security Tests:** 10 / 10 passed (`npm run test:security`).
- **Database & Integrity Tests:** 6 / 6 passed (`npm run test:db`).
- **Build Status:** Backend (`tsc`) and Frontend (`vite build`) compiled with **0 errors**.

---

## 2. Verified Vulnerabilities, Fixes & Threat Models

### Vulnerability 1: Client-Supplied Price Trust & Arbitrary Catalog Item Injection
- **CWE:** CWE-20 (Improper Input Validation), CWE-566 (Authorization Bypass Through User-Controlled Key)
- **Severity:** Critical (CVSS 9.8)
- **Location:** `backend/src/controllers/orderController.ts`
- **Threat Model:** A customer could intercept checkout requests and supply `item.price = 0.01` or inject an arbitrary `itemId`. The server previously trusted the client-sent price and, if the `itemId` was not found in the shop, created a new menu item in the database with client-provided parameters.
- **Fix Applied:**
  1. Complete removal of client price trust. All item prices and dynamic clearance discounts are computed strictly server-side from the database.
  2. Automatic creation of menu items during checkout was eliminated. Requests with non-existent or mismatched item IDs are rejected with HTTP 400.
  3. Unavailable/sold-out items cannot be purchased; requests are rejected with HTTP 400.

### Vulnerability 2: Plaintext Hardcoded Database Credentials in Repository
- **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-312 (Cleartext Storage of Sensitive Information)
- **Severity:** Critical (CVSS 9.1)
- **Location:** `backend/test-db.js`
- **Threat Model:** A local test script contained a plaintext root database password (`Harsh@051007`) committed to the repository.
- **Fix Applied:**
  `backend/test-db.js` and `backend/src/db/connection.ts` were permanently removed. All database access is consolidated through Prisma using environment variables loaded securely via `src/config/env.ts`.

### Vulnerability 3: Authentication Bypass Backdoor in Login & Profile Update
- **CWE:** CWE-287 (Improper Authentication), CWE-798 (Use of Hard-coded Credentials)
- **Severity:** Critical (CVSS 9.8)
- **Location:** `backend/src/controllers/authController.ts`
- **Threat Model:** `login` and `updateProfile` contained an explicit bypass: if `password === 'password123' || password === 'admin123' || password === `${stallSlug}@123``, password verification was bypassed regardless of the user's real password. An attacker could take over any student, staff, or administrator account.
- **Fix Applied:**
  All backdoor bypass logic was completely removed. Authentication strictly verifies passwords using `bcrypt.compare(password, user.passwordHash)`.

### Vulnerability 4: Privilege Escalation via Public Registration
- **CWE:** CWE-269 (Improper Privilege Management), CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes)
- **Severity:** High (CVSS 8.8)
- **Location:** `backend/src/controllers/authController.ts`, `backend/src/validators/index.ts`
- **Threat Model:** Public registration accepted `{ role: 'ADMIN' }` or `{ role: 'OWNER' }` in the request body and assigned that role to the new user.
- **Fix Applied:**
  Public registration now hardcodes role assignment strictly to `'CUSTOMER'`. Role modification is restricted to administrative endpoints protected by `requireAdmin`.

### Vulnerability 5: Broken Object-Level Authorization (BOLA) on Owner & Staff Routes
- **CWE:** CWE-639 (Insecure Direct Object Reference / BOLA), CWE-285 (Improper Authorization)
- **Severity:** Critical (CVSS 9.1)
- **Location:** `backend/src/routes/owner.ts`, `backend/src/routes/staff.ts`, `backend/src/controllers/ownerController.ts`
- **Threat Model:** Any authenticated customer token could invoke `/api/owner/items`, `/api/owner/sales`, `/api/staff/orders`, and `/api/staff/menu`. Staff could also modify menu items and view sales for stalls they did not own.
- **Fix Applied:**
  1. `requireStaffOrAdmin` (`requireRole(['STAFF', 'OWNER', 'ADMIN'])`) mounted on `/api/staff`.
  2. `requireRole(['OWNER', 'ADMIN'])` mounted on `/api/owner`.
  3. Stall boundary enforcement helper `isAuthorizedForShop`: verifies that staff/owners can only view and modify items and orders for their assigned stall (`req.user.shopId === targetShopId`). Global administrators retain cross-stall management privileges.

### Vulnerability 6: Insecure Fallback JWT Secret & Weak Verification
- **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-327 (Use of a Broken or Risky Cryptographic Algorithm)
- **Severity:** High (CVSS 7.5)
- **Location:** `backend/src/middleware/auth.ts`, `backend/src/controllers/authController.ts`
- **Threat Model:** `process.env.JWT_SECRET || 'super_secret'` allowed forging arbitrary JWT tokens if `JWT_SECRET` was unset in the environment. `jwt.verify` did not enforce signing algorithms.
- **Fix Applied:**
  1. Removed all fallback secrets. The application terminates immediately at startup via `src/config/env.ts` if `JWT_SECRET` is missing (and enforces minimum 32 characters in production).
  2. Enforced algorithm `HS256` explicitly in `jwt.sign` and `jwt.verify`.

### Vulnerability 7: Synthetic Order Injection During Review Submission
- **CWE:** CWE-840 (Business Logic Errors / Data Corruption)
- **Severity:** Medium (CVSS 6.5)
- **Location:** `backend/src/controllers/reviewController.ts`
- **Threat Model:** When a customer submitted a review for an outlet they had never purchased from, the server inserted a synthetic completed order into the database to satisfy foreign key constraints, corrupting platform revenue and order statistics.
- **Fix Applied:**
  Synthetic order generation was eliminated. Review submission now verifies that the authenticated customer has completed an authentic order with the stall (`order.status === 'COMPLETED'`). If no verified purchase exists, the server rejects the request with HTTP 403 Forbidden.

### Vulnerability 8: Permissive Wildcard CORS & Missing Rate Limiting
- **CWE:** CWE-942 (Overly Permissive CORS), CWE-307 (Improper Restriction of Excessive Authentication Attempts)
- **Severity:** High (CVSS 7.5)
- **Location:** `backend/src/app.ts`
- **Threat Model:** Default `cors()` allowed any origin to initiate cross-origin requests. Missing rate limiters left `/api/auth/login` and order endpoints open to brute-force credential stuffing and denial of service.
- **Fix Applied:**
  1. Configured CORS with an explicit allowlist from `env.ALLOWED_ORIGINS` (defaults to trusted frontend ports).
  2. Implemented `authLimiter` (30 requests/15 mins on `/login` and `/register`), `orderLimiter` (20 orders/min), `reviewLimiter` (15 reviews/15 mins), and `generalLimiter` (400 requests/15 mins).

### Vulnerability 9: Missing Security Headers & Unbounded Payloads
- **CWE:** CWE-400 (Uncontrolled Resource Consumption)
- **Severity:** Medium (CVSS 5.3)
- **Location:** `backend/src/app.ts`
- **Fix Applied:**
  1. Integrated `helmet()` middleware to enforce security headers (X-Content-Type-Options, Strict-Transport-Security, X-Frame-Options, etc.).
  2. Enforced a `50kb` request body limit on `express.json` and `express.urlencoded` to prevent memory exhaustion attacks.
  3. Added centralized safe error handling to prevent leaking stack traces or internal database errors in responses.

---

## 3. Secret-Rotation Checklist

> [!WARNING]
> Because previously reviewed ZIP bundles contained configuration with Supabase PostgreSQL connection strings and JWT signing secrets, **those credentials must be assumed compromised**.
> Per security requirements, remote production credentials must not be rotated automatically without explicit infrastructure access and scheduled maintenance windows. Use the following checklist to rotate all credentials safely.

### 3.1 Database Credential Rotation (Supabase PostgreSQL)
- [ ] **Step 1:** Access the Supabase Project Dashboard &rarr; **Project Settings** &rarr; **Database**.
- [ ] **Step 2:** Under **Database Password**, select **Reset Database Password**.
- [ ] **Step 3:** Generate a high-entropy password (minimum 24 characters, alphanumeric + symbols).
- [ ] **Step 4:** Update the connection pooler URI (`DATABASE_URL`) and direct URI (`DIRECT_URL`) in your production hosting environment (e.g. Render, Railway, AWS ECS, or Vercel).
- [ ] **Step 5:** Trigger a redeployment of the backend application.
- [ ] **Step 6:** Verify health check at `GET /api/health` and verify database operations via `npm run test:db`.

### 3.2 JWT Signing Secret Rotation
- [ ] **Step 1:** Generate a cryptographically secure random string (minimum 64 characters):
  ```bash
  # Generate using OpenSSL
  openssl rand -base64 48
  ```
- [ ] **Step 2:** Update `JWT_SECRET` in the backend production environment settings.
- [ ] **Step 3:** Redeploy the backend.
  *(Note: Rotating `JWT_SECRET` safely invalidates all existing active user sessions, requiring users to log in again).*
- [ ] **Step 4:** Verify that login (`POST /api/auth/login`) issues valid tokens and `/api/auth/me` verifies them.

### 3.3 Supabase API Keys Rotation
- [ ] **Step 1:** Access Supabase Dashboard &rarr; **Project Settings** &rarr; **API**.
- [ ] **Step 2:** Roll the **anon (public)** key and **service_role (secret)** key.
- [ ] **Step 3:** Update production environment variables and redeploy.

---

## 4. Defense-in-Depth Architecture

```
[ Incoming HTTP Request ]
           │
           ▼
┌──────────────────────────────────────┐
│ Helmet HTTP Security Headers         │ (X-Frame-Options, CSP, HSTS, X-Content-Type)
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Environment-Based CORS Allowlist     │ (Restricts origins to env.ALLOWED_ORIGINS)
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Request Payload Limiter (50KB)       │ (Blocks large denial-of-service payloads)
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Rate Limiters (IP-based)             │ (authLimiter: 30/15m, orderLimiter: 20/1m)
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Zod Schema Validation                │ (Strict type, range, string, and enum validation)
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ JWT Authentication (HS256)           │ (Validates token, claims, expiration; no fallback)
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ RBAC & Stall Boundary Isolation      │ (requireRole, isAuthorizedForShop)
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Business Logic & Server Calculations │ (Authoritative DB pricing; valid state transitions)
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Centralized Safe Error Handler       │ (Hides stack traces and DB internal messages)
└──────────────────────────────────────┘
```

---

## 5. Automated Security Regression Test Results

An automated security test suite was authored in [`backend/scripts/security-tests.ts`](file:///D:/Campus%20Bites/Campus-Bites/backend/scripts/security-tests.ts) and wired to `npm run test:security`:

```
====================================================
🛡️  RUNNING EXHAUSTIVE APPLICATION SECURITY TESTS
====================================================
  ✅ PASS: Unauthenticated access to protected routes returns 401
  ✅ PASS: Customer token access to admin routes returns 403 Forbidden
  ✅ PASS: Staff assigned to Stall 1 cannot modify menu or orders for Stall 2
  ✅ PASS: Customer B cannot view or cancel Customer A's order
  ✅ PASS: Registration ignores client-supplied role and enforces CUSTOMER
  ✅ PASS: Rejects invalid quantities, non-existent item IDs, and cross-stall items
  ✅ PASS: Server ignores client-tampered price and computes authoritative total from DB
  ✅ PASS: State machine rejects illegal status transitions (e.g. PLACED -> COMPLETED)
  ✅ PASS: Auth rate limiter throttles excessive rapid requests with HTTP 429
  ✅ PASS: Environment schema fails safely when JWT_SECRET is weak in production
====================================================
🏁 SECURITY TEST RESULTS: 10 PASSED | 0 FAILED
====================================================
```

### Coverage Breakdown
1. **Unauthenticated Access:** Verified on `/api/orders`, `/api/staff/orders`, `/api/admin/stats`, `/api/owner/sales`.
2. **Horizontal Privilege Escalation:** Verified that customer tokens cannot access `/api/admin/*` or `/api/owner/*`.
3. **Multi-Tenant Stall Isolation:** Verified that staff assigned to Stall 1 cannot modify menu items or order queues for Stall 2.
4. **Direct Object References (IDOR):** Verified that customers cannot read or cancel orders belonging to other customers.
5. **Role Tampering:** Verified that registration requests with `{ role: 'ADMIN' }` are neutralized to role `'CUSTOMER'`.
6. **Input & Boundary Testing:** Verified that negative quantities (`-5`), non-existent item IDs (`999999`), and cross-stall items are rejected with HTTP 400.
7. **Price Integrity:** Verified that orders submitted with client-tampered prices (`₹0.01`) and totals (`₹0.02`) are computed from authoritative database prices and discounts.
8. **State Machine Integrity:** Verified that illegal status transitions (such as `PLACED` &rarr; `COMPLETED`) are rejected with HTTP 400.
9. **Rate Limiting:** Verified that burst authentication requests receive HTTP 429 Too Many Requests after 30 attempts.
10. **Fail-Safe Secrets:** Verified that the environment schema throws a validation failure if `JWT_SECRET` is less than 32 characters in production.

---

## 6. Remaining Risks & Operational Recommendations

1. **Scheduled Server-Side Autobook Worker:**
   - *Status:* Recurring Autobook schedule creation and toggle endpoints are fully secured. However, recurring daily execution currently depends on an active browser tab timer (`App.tsx`).
   - *Recommendation:* Transition the trigger mechanism to an in-process `node-cron` worker in the backend for autonomous unattended execution.
2. **Production Secret Rotation Execution:**
   - *Status:* The application is prepared to receive rotated secrets.
   - *Action Required:* Execute the [Secret-Rotation Checklist](#3-secret-rotation-checklist) on your production Supabase project and hosting environment prior to public launch.
3. **Live Payment Gateway Webhook Signature Verification:**
   - *Status:* The demo payment simulator is safe from financial loss as it is explicitly a demo. When integrating real payment gateways (e.g. Razorpay or Stripe), ensure HMAC SHA256 webhook signature verification is enabled before marking orders as paid.
