const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Static files will be served AFTER API routes to prevent conflicts

// Database Setup
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ CRITICAL ERROR: DATABASE_URL environment variable is missing.');
    console.error('📝 Create a .env file with: DATABASE_URL=postgresql://user:password@host:port/database');
    console.error('📖 See SETUP_RENDER.md for detailed instructions');
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect().then(() => {
    console.log('✅ Connected to PostgreSQL database');
    initDb();
}).catch(err => {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
});

async function query(text, params) {
    return await pool.query(text, params);
}

// Time Slots Configuration
const TIME_SLOTS = [
    '9:00-10:00', '10:00-11:00', '11:00-11:10', '11:10-12:00',
    '12:00-01:00', '01:00-01:40', '01:40-03:00', '03:00-03:50',
    '03:50-04:00', '04:00-05:00', '05:00-06:00'
];

async function initDb() {
    try {
        // Users table
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                plain_password VARCHAR(255),
                role VARCHAR(50) DEFAULT 'employee',
                email VARCHAR(255),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Activities table
        await query(`
            CREATE TABLE IF NOT EXISTS activities (
                id SERIAL PRIMARY KEY,
                dateKey VARCHAR(255) NOT NULL,
                userId INTEGER NOT NULL,
                timeSlot VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                description TEXT,
                totalPages VARCHAR(50),
                pagesDone VARCHAR(50),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        // Create index for faster queries
        await query(`
            CREATE INDEX IF NOT EXISTS idx_activities_date_user 
            ON activities(dateKey, userId);
        `);

        // Leave requests table
        await query(`
            CREATE TABLE IF NOT EXISTS leave_requests (
                id SERIAL PRIMARY KEY,
                userId INTEGER NOT NULL,
                startDate VARCHAR(255),
                endDate VARCHAR(255),
                reason TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_leave_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        // Permissions table
        await query(`
            CREATE TABLE IF NOT EXISTS permissions (
                id SERIAL PRIMARY KEY,
                userId INTEGER NOT NULL,
                date VARCHAR(255),
                startTime VARCHAR(255),
                endTime VARCHAR(255),
                reason TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_permission_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        // Activity log table
        await query(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                dateKey VARCHAR(255),
                employeeName VARCHAR(255) NOT NULL,
                activityType VARCHAR(255),
                description TEXT,
                timeSlot VARCHAR(255),
                action VARCHAR(50),
                editedBy VARCHAR(255),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Reminders table for notification system
        await query(`
            CREATE TABLE IF NOT EXISTS reminders (
                id SERIAL PRIMARY KEY,
                userId INTEGER NOT NULL,
                dateKey VARCHAR(255) NOT NULL,
                message TEXT,
                sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sentBy VARCHAR(255),
                status VARCHAR(50) DEFAULT 'sent',
                CONSTRAINT fk_reminder_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        // Activity History table (New Audit System)
        await query(`
            CREATE TABLE IF NOT EXISTS activity_history (
                id SERIAL PRIMARY KEY,
                activity_id INTEGER,
                user_id INTEGER,
                action_type VARCHAR(50),
                action_by INTEGER,
                old_data TEXT,
                new_data TEXT,
                date_key VARCHAR(50),
                time_slot VARCHAR(50),
                ip_address VARCHAR(50),
                user_agent TEXT,
                action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_name VARCHAR(255),
                action_by_name VARCHAR(255)
            );
        `);

        // Indexes for history
        await query(`CREATE INDEX IF NOT EXISTS idx_hist_user ON activity_history(user_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_hist_date ON activity_history(date_key);`);

        // Create default users
        const adminUsername = 'admin@pristonix';
        const adminPassword = '!pristonixadmin#@2026';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        await query(`
            INSERT INTO users (name, username, password, plain_password, role, email)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (username) DO NOTHING
        `, ['Master Admin', adminUsername, hashedPassword, adminPassword, 'admin', 'admin@pristonix.com']);

        // Create Admin2 (Supervisor)
        const admin2Password = 'password123';
        const hashedAdmin2 = await bcrypt.hash(admin2Password, 10);
        await query(`
            INSERT INTO users (name, username, password, plain_password, role, email)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (username) DO NOTHING
        `, ['Supervisor', 'admin2', hashedAdmin2, admin2Password, 'admin', 'admin2@pristonix.com']);

        // Create Guest Admin (View-Only + Reminders)
        const guestPassword = '#guestuser';
        const hashedGuest = await bcrypt.hash(guestPassword, 10);
        await query(`
            INSERT INTO users (name, username, password, plain_password, role, email)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (username) DO NOTHING
        `, ['Guest Admin', 'guest@pristonix', hashedGuest, guestPassword, 'guest', 'guest@pristonix.com']);

        console.log('✅ Database schema synchronized');
        console.log('👤 Admin: admin@pristonix');
        console.log('👤 Supervisor: admin2');
        console.log('👤 Guest: guest@pristonix');
    } catch (err) {
        console.error('❌ Error initializing database:', err);
    }
}

// ==========================================
// AUTH ROUTES
// ==========================================
app.post('/api/login', async (req, res) => {
    let { username, password } = req.body;
    if (username) username = username.trim();
    if (password) password = password.trim();

    try {
        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Try bcrypt comparison
        let isValidPassword = await bcrypt.compare(password, user.password);

        // Fallback: Check plain text and migrate
        if (!isValidPassword && password === user.password) {
            console.log(`Migrating user ${username} to hashed password...`);
            const newHash = await bcrypt.hash(password, 10);
            await query('UPDATE users SET password = $1 WHERE id = $2', [newHash, user.id]);
            isValidPassword = true;
        }

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
                email: user.email,
                employeeId: user.id
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// USERS/EMPLOYEES ROUTES
// ==========================================
app.get('/api/users', async (req, res) => {
    try {
        const result = await query('SELECT id, name, username, role, email, createdAt FROM users ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get user with password (for admin editing)
app.get('/api/users/:id/password', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('SELECT id, name, username, plain_password, role, email FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        // Return plain_password as 'password' field, or empty string if null
        res.json({
            id: user.id,
            name: user.name,
            username: user.username,
            password: user.plain_password || '',  // Fallback to empty string if null
            role: user.role,
            email: user.email
        });
    } catch (err) {
        console.error('Error fetching user password:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { name, username, password, role, email } = req.body;

    try {
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Name, Username and Password are required.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(`
            INSERT INTO users (name, username, password, plain_password, role, email, createdAt)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            RETURNING id, name, username, role, email
        `, [name, username, hashedPassword, password, role || 'employee', email || '']);

        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, password, role, email } = req.body;

    try {
        let updateQuery = `UPDATE users SET name = $1, username = $2, role = $3, email = $4`;
        let params = [name, username, role || 'employee', email || ''];

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password.trim(), 10);
            updateQuery += `, password = $5, plain_password = $6 WHERE id = $7 RETURNING id, name, username, role, email`;
            params.push(hashedPassword, password.trim(), id);
        } else {
            updateQuery += ` WHERE id = $5 RETURNING id, name, username, role, email`;
            params.push(id);
        }

        const result = await query(updateQuery, params);
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Username already taken' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ACTIVITIES ROUTES
// ==========================================
app.get('/api/activities', async (req, res) => {
    const { dateKey, userId } = req.query;
    let text = 'SELECT * FROM activities WHERE 1=1';
    let params = [];
    let paramCount = 1;

    if (dateKey) {
        text += ` AND dateKey = $${paramCount}`;
        params.push(dateKey);
        paramCount++;
    }

    if (userId) {
        text += ` AND userId = $${paramCount}`;
        params.push(userId);
    }

    text += ' ORDER BY id';

    try {
        const result = await query(text, params);

        // Group activities by dateKey, userId, and timeSlot
        const activities = {};
        result.rows.forEach(row => {
            if (!activities[row.datekey]) activities[row.datekey] = {};
            if (!activities[row.datekey][row.userid]) activities[row.datekey][row.userid] = {};
            if (!activities[row.datekey][row.userid][row.timeslot]) {
                activities[row.datekey][row.userid][row.timeslot] = [];
            }
            activities[row.datekey][row.userid][row.timeslot].push({
                id: row.id,
                type: row.type,
                description: row.description,
                totalPages: row.totalpages,
                pagesDone: row.pagesdone,
                timestamp: row.timestamp
            });
        });

        res.json(activities);
    } catch (err) {
        console.error('Get activities error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/activities', async (req, res) => {
    const { dateKey, userId, employeeId, timeSlot, type, description, totalPages, pagesDone, timestamp } = req.body;
    const finalUserId = userId || employeeId;

    console.log('Saving activity to PostgreSQL:', { dateKey, userId: finalUserId, timeSlot, type });

    try {
        await query(`
            INSERT INTO activities (dateKey, userId, timeSlot, type, description, totalPages, pagesDone, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [dateKey, finalUserId, timeSlot, type, description || '', totalPages || '0', pagesDone || '0', timestamp || new Date().toISOString()]);

        res.json({ status: 'saved' });
    } catch (err) {
        console.error('Save activity error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete individual activity by index
app.delete('/api/activities/individual', async (req, res) => {
    const { dateKey, userId, employeeId, timeSlot, activityIndex } = req.body;
    const finalUserId = userId || employeeId;

    console.log('🗑️  DELETE Individual Activity Request:', { dateKey, userId, employeeId, finalUserId, timeSlot, activityIndex });

    if (!dateKey || !finalUserId || !timeSlot || activityIndex === undefined) {
        console.error('❌ Missing required parameters:', { dateKey, finalUserId, timeSlot, activityIndex });
        return res.status(400).json({
            error: 'Missing required parameters',
            received: { dateKey, userId: finalUserId, timeSlot, activityIndex }
        });
    }

    try {
        // Get all activities for this slot
        const activities = await query(`
            SELECT id FROM activities 
            WHERE dateKey = $1 AND userId = $2 AND timeSlot = $3
            ORDER BY id
        `, [dateKey, finalUserId, timeSlot]);

        if (activities.rows.length === 0) {
            return res.status(404).json({ error: 'No activities found for this slot' });
        }

        if (activityIndex >= activities.rows.length) {
            return res.status(400).json({ error: 'Invalid activity index' });
        }

        // Delete the specific activity by its ID
        const activityToDelete = activities.rows[activityIndex];
        const result = await query(`
            DELETE FROM activities WHERE id = $1
        `, [activityToDelete.id]);

        console.log(`✅ Deleted activity ID ${activityToDelete.id} (index ${activityIndex}) for user ${finalUserId}, slot ${timeSlot}`);
        res.json({ message: 'Activity deleted', deletedId: activityToDelete.id });
    } catch (err) {
        console.error('❌ Delete individual activity error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/activities', async (req, res) => {
    const { dateKey, userId, employeeId, timeSlot } = req.body;
    const finalUserId = userId || employeeId;

    console.log('🗑️  DELETE Request:', { dateKey, userId, employeeId, finalUserId, timeSlot });

    if (!dateKey || !finalUserId || !timeSlot) {
        console.error('❌ Missing required parameters:', { dateKey, finalUserId, timeSlot });
        return res.status(400).json({
            error: 'Missing required parameters',
            received: { dateKey, userId: finalUserId, timeSlot }
        });
    }

    try {
        const result = await query(`
            DELETE FROM activities 
            WHERE dateKey = $1 AND userId = $2 AND timeSlot = $3
        `, [dateKey, finalUserId, timeSlot]);

        console.log(`✅ Deleted ${result.rowCount} activities for user ${finalUserId}, slot ${timeSlot}`);
        res.json({ message: 'Activity cleared', deletedCount: result.rowCount });
    } catch (err) {
        console.error('❌ Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ACTIVITY LOG & AUDIT ROUTES
// ==========================================

// Audit Log Helper
async function logActivityHistory(userId, actionType, actionBy, dateKey, timeSlot, oldData, newData, req) {
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : 'unknown';
        const userAgent = req ? req.headers['user-agent'] : 'unknown';
        const actionByUserId = actionBy || userId;

        // Resolve Names
        let userName = 'Unknown';
        let actionByName = 'System';

        if (userId) {
            const u = await query('SELECT name FROM users WHERE id = $1', [userId]);
            if (u.rows[0]) userName = u.rows[0].name;
        }
        if (actionByUserId) {
            const a = await query('SELECT name FROM users WHERE id = $1', [actionByUserId]);
            if (a.rows[0]) actionByName = a.rows[0].name;
        } else {
            actionByName = userName;
        }

        await query(`
            INSERT INTO activity_history 
            (activity_id, user_id, action_type, action_by, old_data, new_data, date_key, time_slot, ip_address, user_agent, user_name, action_by_name)
            VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            userId,
            actionType,
            actionByUserId,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            dateKey,
            timeSlot,
            ip,
            userAgent,
            userName,
            actionByName
        ]);
        console.log(`Audit Logged (PSQL): ${actionType} | User: ${userName}`);
    } catch (e) {
        console.error('Audit Log Error (PSQL):', e);
    }
}

// Get Audit History (Admin Only)
app.get('/api/audit/history', async (req, res) => {
    const { date, userId, actionType, limit } = req.query;

    let text = `
        SELECT h.*, 
        COALESCE(h.user_name, u.name) as userName, 
        COALESCE(h.action_by_name, a.name) as actionByName, 
        a.role as actionByRole, 
        u.role as targetRole
        FROM activity_history h
        LEFT JOIN users u ON h.user_id = u.id
        LEFT JOIN users a ON h.action_by = a.id
    `;

    const params = [];
    const clauses = [];

    if (date) { clauses.push(`h.date_key = $${params.length + 1}`); params.push(date); }
    if (userId) { clauses.push(`h.user_id = $${params.length + 1}`); params.push(userId); }
    if (actionType) { clauses.push(`h.action_type = $${params.length + 1}`); params.push(actionType); }

    if (clauses.length > 0) {
        text += ' WHERE ' + clauses.join(' AND ');
    }

    text += ` ORDER BY h.action_timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit || 100);

    try {
        const result = await query(text, params);

        const processed = result.rows.map(row => {
            let oldData = null;
            let newData = null;
            try { if (row.old_data) oldData = JSON.parse(row.old_data); } catch (e) { }
            try { if (row.new_data) newData = JSON.parse(row.new_data); } catch (e) { }
            return { ...row, old_data: oldData, new_data: newData };
        });

        res.json(processed);
    } catch (err) {
        console.error('Audit API Error:', err);
        res.status(500).json({ error: 'Database error fetching history' });
    }
});

// Legacy Activity Log Routes
app.get('/api/activity-log', async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const date = req.query.date;

    try {
        let text = 'SELECT * FROM activity_log';
        const params = [];

        if (date) {
            text += ' WHERE dateKey = $1';
            params.push(date);
        }

        text += ' ORDER BY id DESC LIMIT $' + (params.length + 1);
        params.push(limit);

        const result = await query(text, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/activity-log', async (req, res) => {
    const { employeeName, activityType, description, timeSlot, action, editedBy, timestamp, dateKey } = req.body;

    try {
        await query(`
            INSERT INTO activity_log (dateKey, employeeName, activityType, description, timeSlot, action, editedBy, timestamp, createdAt)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        `, [dateKey, employeeName, activityType, description, timeSlot, action, editedBy || 'System', timestamp || new Date().toISOString()]);
        res.json({ status: 'logged' });
    } catch (err) {
        console.error('Activity log error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/activity-log', async (req, res) => {
    try {
        const result = await query('DELETE FROM activity_log');
        res.json({ message: 'Activity log cleared', changes: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// LEAVE & PERMISSION ROUTES
// ==========================================
app.post('/api/leave', async (req, res) => {
    const { userId, startDate, endDate, reason, isFullDay } = req.body;

    try {
        const result = await query(`
            INSERT INTO leave_requests (userId, startDate, endDate, reason, createdAt)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            RETURNING *
        `, [userId, startDate, endDate, reason]);

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/leave', async (req, res) => {
    const { userId } = req.query;
    try {
        let text = `SELECT l.*, u.name as userName FROM leave_requests l JOIN users u ON l.userId = u.id`;
        const params = [];
        if (userId) {
            text += ' WHERE l.userId = $1';
            params.push(userId);
        }
        const result = await query(text, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/permission', async (req, res) => {
    const { userId, date, dateKey, startTime, endTime, reason } = req.body;
    const finalDate = date || dateKey;

    try {
        const result = await query(`
            INSERT INTO permissions (userId, date, startTime, endTime, reason, createdAt)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            RETURNING *
        `, [userId, finalDate, startTime, endTime, reason]);

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/permission', async (req, res) => {
    const { userId } = req.query;
    try {
        let text = `SELECT p.*, u.name as userName FROM permissions p JOIN users u ON p.userId = u.id`;
        const params = [];
        if (userId) {
            text += ' WHERE p.userId = $1';
            params.push(userId);
        }
        const result = await query(text, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// NOTIFICATION & REMINDER SYSTEM
// ==========================================

// Get employees who haven't filled timesheet for a date
app.get('/api/missing-timesheet', async (req, res) => {
    const { dateKey } = req.query;
    if (!dateKey) return res.status(400).json({ error: 'dateKey required' });

    try {
        // Get all employees (not admins)
        const employeesResult = await query('SELECT id, name, email FROM users WHERE role = $1', ['employee']);
        const employees = employeesResult.rows;

        // Get activities for the date
        const activitiesResult = await query('SELECT userId, timeSlot FROM activities WHERE dateKey = $1', [dateKey]);
        const activities = activitiesResult.rows;

        // Build a map of what's filled
        const filledMap = {};
        activities.forEach(a => {
            if (!filledMap[a.userid]) filledMap[a.userid] = new Set();
            filledMap[a.userid].add(a.timeslot);
        });

        // Find employees with missing slots
        const missingData = employees.map(emp => {
            const filled = filledMap[emp.id] || new Set();
            const missing = TIME_SLOTS.filter(slot => !filled.has(slot));
            return {
                id: emp.id,
                name: emp.name,
                email: emp.email,
                missingSlots: missing,
                missingCount: missing.length,
                filledCount: TIME_SLOTS.length - missing.length,
                isComplete: missing.length === 0
            };
        }).filter(emp => emp.missingCount > 0);

        res.json({
            dateKey,
            totalEmployees: employees.length,
            employeesWithMissing: missingData.length,
            employees: missingData
        });
    } catch (err) {
        console.error('Missing timesheet check error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Send reminder to specific employee(s)
app.post('/api/send-reminder', async (req, res) => {
    const { userIds, dateKey, message } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds array required' });
    }

    const currentUser = req.body.sentBy || 'Admin';
    const finalMessage = message || `Please fill your timesheet for ${dateKey}. Some time slots are missing.`;

    try {
        const results = [];
        for (const userId of userIds) {
            // Get user details
            const userResult = await query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
            const user = userResult.rows[0];
            if (!user) continue;

            // Store reminder in database
            await query(`
                INSERT INTO reminders (userId, dateKey, message, sentAt, sentBy, status)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, 'sent')
            `, [userId, dateKey, finalMessage, currentUser]);

            results.push({
                userId: user.id,
                name: user.name,
                email: user.email,
                notified: true,
                message: finalMessage
            });

            console.log(`Reminder sent to ${user.name} (${user.email || 'no email'}) for ${dateKey}`);
        }

        res.json({
            success: true,
            remindersCount: results.length,
            reminders: results
        });
    } catch (err) {
        console.error('Send reminder error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get pending reminders for a user
app.get('/api/reminders', async (req, res) => {
    const { userId, status } = req.query;
    try {
        let text = 'SELECT r.*, u.name as userName FROM reminders r JOIN users u ON r.userId = u.id';
        const params = [];
        const conditions = [];

        if (userId) {
            conditions.push(`r.userId = $${conditions.length + 1}`);
            params.push(userId);
        }
        if (status) {
            conditions.push(`r.status = $${conditions.length + 1}`);
            params.push(status);
        }

        if (conditions.length > 0) {
            text += ' WHERE ' + conditions.join(' AND ');
        }
        text += ' ORDER BY r.sentAt DESC LIMIT 100';

        const result = await query(text, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark reminder as read/acknowledged
app.put('/api/reminders/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        await query('UPDATE reminders SET status = $1 WHERE id = $2', [status || 'read', id]);
        res.json({ message: 'Reminder updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auto-check and notify endpoint (for scheduled jobs)
app.post('/api/auto-notify-missing', async (req, res) => {
    const { dateKey } = req.body;
    const checkDate = dateKey || new Date().toISOString().split('T')[0];

    try {
        const employeesResult = await query('SELECT id, name, email FROM users WHERE role = $1', ['employee']);
        const employees = employeesResult.rows;

        const activitiesResult = await query('SELECT userId, timeSlot FROM activities WHERE dateKey = $1', [checkDate]);
        const activities = activitiesResult.rows;

        const filledMap = {};
        activities.forEach(a => {
            if (!filledMap[a.userid]) filledMap[a.userid] = new Set();
            filledMap[a.userid].add(a.timeslot);
        });

        const notificationsSent = [];
        for (const emp of employees) {
            const filled = filledMap[emp.id] || new Set();
            const missing = TIME_SLOTS.filter(slot => !filled.has(slot));

            if (missing.length > 0) {
                // Check if we already sent a reminder today
                const existing = await query(
                    `SELECT id FROM reminders WHERE userId = $1 AND dateKey = $2 AND DATE(sentAt) = CURRENT_DATE`,
                    [emp.id, checkDate]
                );

                if (existing.rows.length === 0) {
                    const message = `You have ${missing.length} unfilled time slot(s) for ${checkDate}: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`;

                    await query(`
                        INSERT INTO reminders (userId, dateKey, message, sentAt, sentBy, status)
                        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'System', 'sent')
                    `, [emp.id, checkDate, message]);

                    notificationsSent.push({
                        name: emp.name,
                        missingCount: missing.length
                    });

                    console.log(`Auto-notification sent to ${emp.name} for ${checkDate}`);
                }
            }
        }

        res.json({
            success: true,
            dateChecked: checkDate,
            notificationsSent: notificationsSent.length,
            employees: notificationsSent
        });
    } catch (err) {
        console.error('Auto-notify error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// EXPORT TO EXCEL
// ==========================================
app.get('/api/export', async (req, res) => {
    const { dateKey } = req.query;
    if (!dateKey) return res.status(400).send('Missing dateKey');

    try {
        const usersResult = await query('SELECT * FROM users WHERE role = $1 ORDER BY name', ['employee']);
        const activitiesResult = await query('SELECT * FROM activities WHERE dateKey = $1', [dateKey]);

        const users = usersResult.rows;
        const activities = activitiesResult.rows;

        // Build activity map
        const activityMap = {};
        activities.forEach(a => {
            if (!activityMap[a.userid]) activityMap[a.userid] = {};
            if (!activityMap[a.userid][a.timeslot]) activityMap[a.userid][a.timeslot] = [];
            activityMap[a.userid][a.timeslot].push(a);
        });

        const data = [];
        const header = ['Employee Name', 'Proof Pages', 'Epub Pages', 'Calibr Pages', ...TIME_SLOTS];
        data.push(header);

        users.forEach(user => {
            const row = [user.name];
            let proofTotal = 0, epubTotal = 0, calibrTotal = 0;

            // Calculate totals
            TIME_SLOTS.forEach(slot => {
                const acts = activityMap[user.id]?.[slot] || [];
                acts.forEach(act => {
                    const pages = parseInt(act.pagesdone) || 0;
                    if (act.type === 'proof') proofTotal += pages;
                    if (act.type === 'epub') epubTotal += pages;
                    if (act.type === 'calibr') calibrTotal += pages;
                });
            });

            row.push(proofTotal || '', epubTotal || '', calibrTotal || '');

            // Add timeslot data
            TIME_SLOTS.forEach(slot => {
                const acts = activityMap[user.id]?.[slot] || [];
                if (acts.length > 0) {
                    const cellContent = acts.map(act => {
                        let text = act.type.toUpperCase();
                        if (act.description) text += `: ${act.description}`;
                        return text;
                    }).join(' | ');
                    row.push(cellContent);
                } else {
                    row.push('');
                }
            });

            data.push(row);
        });

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Timesheet');
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="Timesheet_${dateKey}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (err) {
        console.error('Export error:', err);
        res.status(500).send(err.message);
    }
});

// ==========================================
// SEND PASSWORD EMAIL
// ==========================================
app.post('/api/send-password-email', async (req, res) => {
    const { userId, email, name, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // For now, we'll log the email content to console
        // In production, you would integrate with an email service like SendGrid, AWS SES, or Nodemailer with SMTP

        const emailContent = {
            to: email,
            subject: 'Your Pristonix Timesheet Login Credentials',
            body: `
Hello ${name},

Your login credentials for the Pristonix Timesheet System are:

Username: (Check with admin)
Password: ${password}

Login URL: ${process.env.APP_URL || 'http://localhost:3000'}

Please keep this information secure and do not share it with anyone.

If you did not request this email, please contact your administrator immediately.

Best regards,
Pristonix Admin Team
            `
        };

        console.log('\n📧 ========== PASSWORD EMAIL ==========');
        console.log(`To: ${emailContent.to}`);
        console.log(`Subject: ${emailContent.subject}`);
        console.log(`Body:\n${emailContent.body}`);
        console.log('========================================\n');

        // Log to database for audit trail
        await query(`
            INSERT INTO activity_log (dateKey, employeeName, activityType, description, action, editedBy, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `, [
            new Date().toISOString().split('T')[0],
            name,
            'PASSWORD_EMAIL',
            `Password sent to ${email}`,
            'SENT',
            'Admin'
        ]);

        res.json({
            success: true,
            message: `Password email logged to console. In production, this would be sent to ${email}`,
            note: 'Email functionality requires SMTP configuration. Check server console for email content.'
        });

    } catch (err) {
        console.error('Send password email error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SERVE HTML FILES
// ==========================================
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/history.html', (req, res) => res.sendFile(path.join(__dirname, '../public/history.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// Serve static files AFTER all API routes
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all for SPA
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, () => {
    console.log(`\n🚀 Server running on PostgreSQL!`);
    console.log(`📍 Port: ${port}`);
    console.log(`🌐 URL: http://localhost:${port}`);
    console.log(`📖 Ready for Render.com deployment\n`);
});
