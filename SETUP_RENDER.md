# Deployment Guide for Timesheet Application

## Quick Start (Local)
To run locally with SQLite (easiest for testing):
```bash
npm run dev
```

---

## Deploying to Render.com (Production)

This application is configured to run on Render using PostgreSQL.

### Step 1: Push to GitHub
Ensure your code is committed and pushed to a GitHub repository.
*Note: If your code is in a subfolder (e.g., `ts-main/ts-main`), remember this for Step 3.*

### Step 2: Create Database (PostgreSQL)
1. Log in to [dashboard.render.com](https://dashboard.render.com/).
2. Click **New +** -> **PostgreSQL**.
3. Name it (e.g., `timesheet-db`).
4. Select the Free Plan.
5. Create it.
6. Once created, copy the **Internal Database URL** (looks like `postgres://user:pass@host/db`).

### Step 3: Create Web Service
1. Click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. **Configure Settings**:
    - **Name**: `timesheet-app`
    - **Root Directory**: `ts-main` (IMPORTANT: set this if your package.json is inside a subfolder!). If it's at the top level, leave blank.
    - **Environment**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `npm start`
4. **Environment Variables** (Scroll down):
    - Click **Add Environment Variable**.
    - Key: `DATABASE_URL`
    - Value: `(Paste the Internal Database URL from Step 2)`
    - *(Optional)* Key: `NODE_VERSION`, Value: `18`
5. Click **Create Web Service**.

### Step 4: Verification
Render will build and deploy.
Watch the logs. You should see:
> `✅ Connected to PostgreSQL database`
> `✅ Database schema synchronized`
> `👤 Admin: admin@pristonix`
> `👤 Supervisor: admin2`

Your app is now live!
