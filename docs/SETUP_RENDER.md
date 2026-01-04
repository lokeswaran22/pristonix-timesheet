# 🚀 Deployment Guide for Render

This guide will help you deploy your Timesheet Application to Render with a PostgreSQL database.

## 1. Preparation (Already Done)
- **Cleanup**: Unwanted files have been moved to `_legacy_backup/` (which is ignored by git).
- **Configuration**: `package.json` is updated to run `server-postgres.js` in production.
- **Schema**: A `schema.sql` file is created for reference, but the app will **automatically create tables** on first run.

## 2. Push to GitHub
1. Create a new repository on GitHub.
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Render deployment"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

## 3. Deploy on Render
1. **Sign up/Login** to [Render.com](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select your repository.
4. **Configure the Service**:
   - **Name**: `pristonix-timesheet` (or any name)
   - **Region**: Choose the one closest to you (e.g., Singapore, Frankfurt)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Hobby)

5. **Environment Variables** (Crucial Step):
   - Scroll down to "Environment Variables" and click "Add Environment Variable".
   - You need to add a PostgreSQL database first.

## 4. Create PostgreSQL Database on Render
1. Open a new tab in Render dashboard.
2. Click **New +** and select **PostgreSQL**.
3. **Name**: `timesheet-db`
4. **Database**: `timesheet`
5. **User**: `timesheet_user`
6. **Region**: **MUST** be the same as your Web Service.
7. **Plan**: Free.
8. Click **Create Database**.
9. Once created, copy the **Internal Database URL** (it looks like `postgres://...`).

## 5. Connect Database to Web Service
1. Go back to your Web Service configuration.
2. Add the Environment Variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the **Internal Database URL** you copied.
3. Click **Create Web Service**.

## 6. Verify Deployment
- Render will start building your app.
- Watch the logs. You should see:
  ```
  ✅ Connected to PostgreSQL database
  ✅ Database schema synchronized
  🚀 Server running on PostgreSQL!
  ```
- Once deployed, click the URL provided by Render (e.g., `https://pristonix-timesheet.onrender.com`).

## 7. Admin Access
- **Default Admin User**:
  - **Username**: `admin@pristonix`
  - **Password**: `!pristonixadmin@2025`
- **Admin Panel PIN**: `2025`

## 8. View Your Database
To view your database tables and data:
1. Go to your **PostgreSQL** dashboard on Render.
2. Click on the **Connect** dropdown.
3. You can use the **External Database URL** to connect using a tool like **pgAdmin** or **DBeaver** on your local machine.
   - **Host**: The hostname from External URL
   - **Port**: 5432
   - **Database**: timesheet
   - **Username**: timesheet_user
   - **Password**: (Copy from dashboard)
4. Alternatively, use the **Info** tab in Render to see connection details.

## Troubleshooting
- **White Screen?** Check the browser console (F12) for errors.
- **Database Error?** Ensure `DATABASE_URL` is correct in Environment Variables.
- **Login Failed?** Ensure the database tables were created (check logs for "Database schema synchronized").

---
**Note**: The CSS and Login pages have been preserved exactly as requested.
