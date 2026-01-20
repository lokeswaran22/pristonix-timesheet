# 🚀 Deploy to Render - Complete Guide

## Quick Start (5 Minutes)

### Step 1: Create PostgreSQL Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `pristonix-timesheet-db`
   - **Database**: `pristonix_db`
   - **User**: (auto-generated)
   - **Region**: Choose closest to your users
   - **Plan**: **Free** (or paid for production)
4. Click **"Create Database"**
5. **IMPORTANT**: Copy the **Internal Database URL** (starts with `postgresql://`)
   - Example: `postgresql://pristonix_user:password@dpg-xxx/pristonix_db`

---

### Step 2: Deploy Web Service

1. In Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect your Git repository (GitHub/GitLab)
3. Configure:

   **Basic Settings:**
   - **Name**: `pristonix-timesheet`
   - **Region**: Same as database
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: (leave empty)
   - **Runtime**: **Node**
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

   **Environment Variables:**
   Click **"Advanced"** → **"Add Environment Variable"**

   Add these variables:

   ```
   DATABASE_URL = <paste your Internal Database URL from Step 1>
   NODE_ENV = production
   PORT = 10000
   ```

   **Optional (for email features):**
   ```
   EMAIL_SERVICE = gmail
   EMAIL_USER = your-email@gmail.com
   EMAIL_PASS = your-app-password
   ```

4. Click **"Create Web Service"**

---

### Step 3: Wait for Deployment

Render will:
1. Clone your repository
2. Run `npm install`
3. Start the server with `npm start`
4. Create database tables automatically

**Watch the logs** for:
```
✅ Connected to PostgreSQL database
✅ Database schema synchronized
👤 Admin: admin@pristonix
👤 Supervisor: admin2
👤 Guest: guest@pristonix
Server running on port 10000
```

---

### Step 4: Access Your Application

1. Once deployed, Render provides a URL like:
   ```
   https://pristonix-timesheet.onrender.com
   ```

2. **Login with default credentials:**
   - **Admin**: `admin@pristonix` / `!pristonixadmin#@2026`
   - **Supervisor**: `admin2` / `password123`
   - **Guest**: `guest@pristonix` / `#guestuser`

3. **IMPORTANT**: Change default passwords immediately!

---

## 🔧 Troubleshooting

### Issue: "DATABASE_URL environment variable is missing"

**Solution:**
1. Go to your web service in Render
2. Click **"Environment"** tab
3. Add `DATABASE_URL` with your PostgreSQL connection string
4. Click **"Save Changes"**
5. Service will auto-redeploy

---

### Issue: Database connection fails

**Symptoms:**
```
❌ Failed to connect to PostgreSQL: connection refused
```

**Solution:**
1. Verify you're using the **Internal Database URL** (not External)
2. Check database and web service are in the **same region**
3. Ensure database is fully created (green status)
4. Check for typos in DATABASE_URL

---

### Issue: Audit logs not storing

**Check logs for:**
```
✅ Audit Logged (PSQL): CREATE | User: John Doe
```

If you don't see this:
1. Check `activity_history` table exists:
   ```sql
   SELECT COUNT(*) FROM activity_history;
   ```
2. Verify DATABASE_URL is set correctly
3. Check server logs for errors

---

### Issue: Free tier sleeps after inactivity

**Symptom**: First request takes 30+ seconds

**Solutions:**
1. **Upgrade to paid plan** ($7/month) - No sleep
2. **Use a ping service**: [UptimeRobot](https://uptimerobot.com/) (free)
   - Ping your URL every 5 minutes to keep it awake
3. **Accept the delay** - Free tier is fine for testing

---

## 📊 Verify Deployment

### 1. Check Database Tables

In Render Dashboard → PostgreSQL → **"Connect"** → **"External Connection"**

```bash
# Connect via psql
psql <External Database URL>

# List tables
\dt

# Should show:
# users, activities, activity_history, leave_requests, permissions, 
# reminders, activity_log, system_settings

# Check audit logs
SELECT COUNT(*) FROM activity_history;

# View latest audit entry
SELECT * FROM activity_history ORDER BY id DESC LIMIT 1;
```

### 2. Test API Endpoints

```bash
# Replace with your Render URL
export API_URL="https://pristonix-timesheet.onrender.com"

# Test login
curl -X POST $API_URL/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@pristonix","password":"!pristonixadmin#@2026"}'

# Test audit logs
curl $API_URL/api/audit/history?limit=5
```

### 3. Monitor Logs

In Render Dashboard → Your Web Service → **"Logs"** tab

Look for:
- ✅ Database connection success
- ✅ Schema synchronized
- ✅ Audit log entries
- ❌ Any error messages

---

## 🔒 Security Checklist

After deployment:

- [ ] Change admin password
- [ ] Change admin2 password
- [ ] Change guest password
- [ ] Update admin PIN (default: `0000`)
- [ ] Add real email credentials (if using email features)
- [ ] Enable 2FA on Render account
- [ ] Review user access regularly

---

## 💰 Cost Breakdown

### Free Tier (Good for Testing)
- **PostgreSQL**: Free (1GB storage, 1GB RAM)
- **Web Service**: Free (512MB RAM, sleeps after 15min inactivity)
- **Total**: $0/month

### Paid Tier (Recommended for Production)
- **PostgreSQL**: $7/month (10GB storage, 1GB RAM, no sleep)
- **Web Service**: $7/month (512MB RAM, no sleep)
- **Total**: $14/month

---

## 🔄 Update Deployment

### Method 1: Auto-Deploy (Recommended)

1. Push changes to your Git repository:
   ```bash
   git add .
   git commit -m "Update application"
   git push origin main
   ```

2. Render automatically detects and deploys

### Method 2: Manual Deploy

1. Go to Render Dashboard → Your Web Service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ Yes | - | PostgreSQL connection string |
| `NODE_ENV` | ✅ Yes | `production` | Environment mode |
| `PORT` | ❌ No | `10000` | Server port (Render sets automatically) |
| `EMAIL_SERVICE` | ❌ No | `gmail` | Email service provider |
| `EMAIL_USER` | ❌ No | - | Email username |
| `EMAIL_PASS` | ❌ No | - | Email password/app password |

---

## 🗄️ Database Backup

### Automatic Backups (Paid Plans Only)

Render automatically backs up paid PostgreSQL databases daily.

### Manual Backup

```bash
# Get External Database URL from Render dashboard
export DB_URL="<External Database URL>"

# Backup to file
pg_dump $DB_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DB_URL < backup_20260121.sql
```

---

## 🚨 Common Errors

### Error: "Cannot find module 'pg'"

**Solution**: Already fixed - `pg` is in package.json dependencies

### Error: "relation 'users' does not exist"

**Solution**: Database initialization failed. Check logs and redeploy.

### Error: "password authentication failed"

**Solution**: Double-check DATABASE_URL is correct and complete.

---

## 📞 Support

If you encounter issues:

1. **Check Render Logs**: Dashboard → Service → Logs tab
2. **Check Database Status**: Dashboard → PostgreSQL → Status
3. **Verify Environment Variables**: Dashboard → Service → Environment tab
4. **Review this guide**: Ensure all steps completed
5. **Contact Render Support**: [Render Community](https://community.render.com/)

---

## ✅ Deployment Checklist

- [ ] PostgreSQL database created on Render
- [ ] Internal Database URL copied
- [ ] Web service created and connected to Git
- [ ] DATABASE_URL environment variable set
- [ ] NODE_ENV set to `production`
- [ ] Deployment successful (green status)
- [ ] Can access application URL
- [ ] Can login with admin credentials
- [ ] Audit logs are working
- [ ] Default passwords changed
- [ ] Admin PIN updated

---

## 🎉 Success!

Your Pristonix Timesheet is now live on Render with:
- ✅ PostgreSQL database (persistent storage)
- ✅ Full audit logging
- ✅ Automatic HTTPS
- ✅ Auto-deploy on Git push
- ✅ Professional hosting

**Your application URL**: `https://pristonix-timesheet.onrender.com`

---

**Need Help?** Check the troubleshooting section or review the Render logs for detailed error messages.

**Last Updated**: 2026-01-21
