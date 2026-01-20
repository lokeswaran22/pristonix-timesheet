# Deployment Troubleshooting Guide - Audit Log Issues

## 🚨 Problem: Audit Logs Not Storing After Deployment

This guide helps diagnose and fix audit log issues in production environments.

---

## 🔍 Diagnostic Steps

### Step 1: Check Server Logs

After deployment, check your server logs for these messages:

**✅ GOOD - Database Connected:**
```
✅ Connected to SQLite database.
📍 Database location: /path/to/database/timesheet.db
✅ Audit Logged [ID: 123]: CREATE | User: John Doe | Slot: 9:00-10:00
```

**❌ BAD - Database Issues:**
```
❌ Error opening database: SQLITE_CANTOPEN
❌ AUDIT LOG FAILED: Database not initialized
❌ AUDIT LOG ERROR: no such table: activity_history
```

### Step 2: Verify Database Path

The server now logs the database path on startup. Check for:

```
🗄️  Database path: /app/database/timesheet.db
📂 Database directory: /app/database
✅ Directory exists: true
✅ Directory writable: true
```

If you see `Directory writable: false`, you have a permissions issue.

---

## 🛠️ Common Issues & Fixes

### Issue 1: Database File Not Created

**Symptoms:**
- Server logs show: `Error opening database: SQLITE_CANTOPEN`
- No `timesheet.db` file exists

**Solution:**
```bash
# SSH into your server
cd /path/to/your/app

# Create database directory
mkdir -p database

# Set proper permissions
chmod 755 database

# Restart the application
pm2 restart timesheet
# OR
systemctl restart your-app-service
```

---

### Issue 2: Permission Denied

**Symptoms:**
- Database file exists but can't write
- Logs show: `SQLITE_READONLY` or `SQLITE_CANTOPEN`

**Solution:**
```bash
# Fix ownership (replace 'youruser' with actual user)
chown -R youruser:youruser database/
chmod 644 database/timesheet.db
chmod 755 database/

# For Docker/containerized apps
chown -R node:node database/
```

---

### Issue 3: Wrong Database Path

**Symptoms:**
- Database works locally but not in production
- Different path shown in logs

**Solution:**

Add environment variable in your deployment:

**.env (Production)**
```env
DB_PATH=/var/data/timesheet
```

**Or for cloud platforms:**

**Heroku:**
```bash
heroku config:set DB_PATH=/app/database
```

**Railway:**
```bash
railway variables set DB_PATH=/app/database
```

**Render:**
Add in dashboard: `DB_PATH` = `/opt/render/project/src/database`

---

### Issue 4: Table Not Created

**Symptoms:**
- Logs show: `no such table: activity_history`
- Database file exists but empty

**Solution:**

The `initDb()` function should run automatically. If it doesn't:

```bash
# Option 1: Delete database and restart (will recreate)
rm database/timesheet.db
pm2 restart timesheet

# Option 2: Manually run schema (if you have access)
sqlite3 database/timesheet.db < database/audit-log-schema.sql
```

---

### Issue 5: Read-Only File System

**Symptoms:**
- Cloud platform with ephemeral storage
- Database resets on every deploy

**Solution:**

**For platforms with ephemeral storage (Heroku, Railway, etc.):**

You MUST use persistent storage:

**Option A: Use PostgreSQL Instead**
```bash
# Install PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Update your app to use server-postgres.js
# (Already included in your project)
```

**Option B: Use External Storage**
- Mount a persistent volume
- Use cloud database service (AWS RDS, Google Cloud SQL)

---

## 📋 Platform-Specific Guides

### Heroku Deployment

**Issue**: Heroku has ephemeral file system - SQLite won't persist

**Solution**: Use PostgreSQL

```bash
# 1. Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# 2. Update package.json start script
"start": "node server/server-postgres.js"

# 3. Deploy
git push heroku main
```

---

### Railway Deployment

**Issue**: Similar ephemeral storage

**Solution**: Add PostgreSQL plugin

1. Go to Railway dashboard
2. Click "New" → "Database" → "PostgreSQL"
3. Update start script to use `server-postgres.js`
4. Redeploy

---

### Render Deployment

**Issue**: Disk not persistent by default

**Solution**: Add persistent disk

1. Go to Render dashboard
2. Select your service
3. Add "Disk" under "Advanced"
4. Mount path: `/opt/render/project/src/database`
5. Set `DB_PATH` environment variable to match

---

### VPS/Traditional Server

**Solution**: Should work out of the box

```bash
# 1. Upload your app
scp -r pristonix-timesheet-main user@server:/var/www/

# 2. Install dependencies
cd /var/www/pristonix-timesheet-main
npm install --production

# 3. Create database directory
mkdir -p database
chmod 755 database

# 4. Start with PM2
pm2 start server/server-sqlite.js --name timesheet
pm2 save
pm2 startup
```

---

## 🧪 Testing Audit Logs

### Test 1: Create Activity

```bash
# Make a request to create an activity
curl -X POST http://your-domain.com/api/activities \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "dateKey": "2026-01-21",
    "timeSlot": "9:00-10:00",
    "type": "epub",
    "description": "Test activity",
    "pagesDone": "10"
  }'

# Check server logs for:
# ✅ Audit Logged [ID: X]: CREATE | User: ...
```

### Test 2: Check Audit Logs

```bash
# Query audit logs
curl http://your-domain.com/api/audit/history?limit=10

# Should return JSON array with recent logs
```

### Test 3: Verify Database

```bash
# SSH into server
sqlite3 database/timesheet.db

# Run query
SELECT COUNT(*) FROM activity_history;

# Should show number of audit entries
```

---

## 🔧 Quick Fixes Checklist

- [ ] Database directory exists
- [ ] Database directory is writable
- [ ] Database file created successfully
- [ ] `activity_history` table exists
- [ ] Server logs show "✅ Audit Logged" messages
- [ ] No permission errors in logs
- [ ] Using persistent storage (not ephemeral)
- [ ] Environment variables set correctly

---

## 📊 Monitoring Audit Logs

### Check Audit Log Count

Add this endpoint to monitor (already included):

```javascript
// GET /api/audit/stats
app.get('/api/audit/stats', async (req, res) => {
    const count = await get('SELECT COUNT(*) as total FROM activity_history');
    const latest = await get('SELECT * FROM activity_history ORDER BY id DESC LIMIT 1');
    res.json({
        totalLogs: count.total,
        latestLog: latest,
        databasePath: dbPath
    });
});
```

---

## 🆘 Still Not Working?

### Enable Debug Mode

Add to your `.env`:
```env
DEBUG=true
NODE_ENV=development
```

This will show more verbose logging.

### Check These Files

1. **Server logs**: `pm2 logs timesheet` or check platform dashboard
2. **Database file**: `ls -la database/`
3. **Permissions**: `ls -la database/timesheet.db`
4. **Disk space**: `df -h`

### Get Help

Provide these details:
1. Deployment platform (Heroku/Railway/VPS/etc.)
2. Server logs (last 50 lines)
3. Database path from logs
4. Output of `ls -la database/`
5. Any error messages

---

## ✅ Verification Commands

Run these after deployment:

```bash
# 1. Check if database exists
ls -la database/timesheet.db

# 2. Check database size (should grow over time)
du -h database/timesheet.db

# 3. Count audit logs
sqlite3 database/timesheet.db "SELECT COUNT(*) FROM activity_history;"

# 4. View latest audit log
sqlite3 database/timesheet.db "SELECT * FROM activity_history ORDER BY id DESC LIMIT 1;"

# 5. Check server logs
pm2 logs timesheet --lines 100
# OR
tail -f /var/log/your-app.log
```

---

## 📝 Summary

**Most Common Issues:**
1. **Permissions** - Fix with `chmod 755 database/`
2. **Ephemeral Storage** - Switch to PostgreSQL or persistent disk
3. **Wrong Path** - Set `DB_PATH` environment variable
4. **Table Not Created** - Restart app to trigger `initDb()`

**After fixing, you should see:**
- ✅ Database file created
- ✅ Audit logs in database
- ✅ "Audit Logged" messages in server logs
- ✅ Data persists across restarts

---

**Last Updated**: 2026-01-21
