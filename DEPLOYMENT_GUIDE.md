# Campus Bites - Supabase Database & Vercel Deployment Guide

This guide details how to connect your **Bites** web application to **Supabase PostgreSQL** and deploy it to **Vercel** so that user accounts, menus, and takeaway orders persist seamlessly across all devices.

---

## Step 1: Connect to Supabase Database

### 1.1 Create a Supabase Project
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and log in.
2. Click **New Project**, select your organization, and name your project `bites-campus`.
3. Set a strong **Database Password** and select your nearest region.
4. Click **Create new project** (takes 1-2 minutes).

### 1.2 Get Supabase Connection Strings & API Keys
1. In Supabase Dashboard, go to **Project Settings** (gear icon) -> **Database**.
2. Scroll to **Connection Strings**:
   - Select **URI** tab.
   - Copy **Transaction Pooler** (Port `6543`) -> Use as `DATABASE_URL`.
   - Copy **Direct Connection** (Port `5432`) -> Use as `DIRECT_URL`.
3. Go to **Project Settings** -> **API**:
   - Copy **Project URL** -> `SUPABASE_URL`.
   - Copy **anon public API Key** -> `SUPABASE_ANON_KEY`.

---

## Step 2: Push Database Schema & Seed Data to Supabase

### 2.1 Update Prisma Provider in `backend/prisma/schema.prisma`
Change `provider = "sqlite"` to `"postgresql"`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 2.2 Configure `backend/.env`
In `backend/.env`, set your copied connection strings:

```env
PORT=5000
JWT_SECRET="your-super-secret-jwt-key"

DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
```

### 2.3 Run Schema Push & Data Seeding Command
Open terminal in `d:\Bites\backend` and run:

```bash
cd backend
npx prisma db push
npx tsx prisma/seed.ts
```

*This will immediately create all tables (User, Shop, FoodItem, Order, etc.) on Supabase and populate all 9 campus outlets + menus!*

---

## Step 3: Deploy to Vercel

1. Commit and push your code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Configure Supabase and Vercel production deployment"
   git push origin main
   ```

2. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New** -> **Project**.
3. Import your `Campus-Bites` GitHub repository.
4. Set **Root Directory** to `frontend` for the UI deployment.
5. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = `https://[YOUR-PROJECT-REF].supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `[YOUR-ANON-KEY]`
   - `VITE_API_URL` = `[YOUR-BACKEND-API-URL]`
6. For Backend deployment on Vercel / Render / Railway:
   - Add `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
7. Click **Deploy**!

---

## Authentication Gate Flow Overview
- Any unauthenticated user accessing `http://localhost:5173/` or any route is instantly presented with the **Login / Sign Up** page (`/login`).
- After entering valid VIT credentials (`@vitstudent.ac.in`), the user is authenticated, assigned a JWT session, and granted access to browse Campus Outlets & place takeaway orders.
