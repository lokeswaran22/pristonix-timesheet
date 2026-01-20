const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL not found in .env file');
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// SQLite database path
const sqliteDbPath = './database/timesheet.db';

async function migrateSQLiteToPostgres() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Starting migration from SQLite to PostgreSQL...\n');

        // Open SQLite database
        const db = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY, async (err) => {
            if (err) {
                console.error('❌ Error opening SQLite database:', err.message);
                reject(err);
                return;
            }

            console.log('✅ Connected to SQLite database\n');

            try {
                // Connect to PostgreSQL
                console.log('🔌 Connecting to PostgreSQL...');
                await pool.connect();
                console.log('✅ Connected to PostgreSQL\n');

                // Migrate Users
                console.log('👥 Migrating users...');
                const users = await new Promise((res, rej) => {
                    db.all('SELECT * FROM users', [], (err, rows) => {
                        if (err) rej(err);
                        else res(rows || []);
                    });
                });

                const userIdMap = new Map(); // Map old IDs to new IDs

                for (const user of users) {
                    try {
                        const result = await pool.query(
                            `INSERT INTO users (name, username, password, role, email, createdAt)
                             VALUES ($1, $2, $3, $4, $5, $6)
                             ON CONFLICT (username) DO UPDATE 
                             SET name = EXCLUDED.name, 
                                 password = EXCLUDED.password, 
                                 role = EXCLUDED.role,
                                 email = EXCLUDED.email
                             RETURNING id`,
                            [
                                user.name,
                                user.username,
                                user.password,
                                user.role || 'employee',
                                user.email || `${user.username}@pristonix.com`,
                                user.createdAt || new Date().toISOString()
                            ]
                        );
                        userIdMap.set(user.id, result.rows[0].id);
                        console.log(`   ✓ Migrated user: ${user.username}`);
                    } catch (err) {
                        console.error(`   ❌ Error migrating user ${user.username}:`, err.message);
                    }
                }
                console.log(`✅ Migrated ${users.length} users\n`);

                // Migrate Activities
                console.log('📝 Migrating activities...');
                const activities = await new Promise((res, rej) => {
                    db.all('SELECT * FROM activities', [], (err, rows) => {
                        if (err) rej(err);
                        else res(rows || []);
                    });
                });

                let activityCount = 0;
                for (const activity of activities) {
                    try {
                        const newUserId = userIdMap.get(activity.userId);
                        if (!newUserId) {
                            console.log(`   ⚠️  Skipping activity - user ID ${activity.userId} not found`);
                            continue;
                        }

                        await pool.query(
                            `INSERT INTO activities (dateKey, userId, timeSlot, type, description, totalPages, pagesDone, timestamp)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                            [
                                activity.dateKey || new Date().toISOString().split('T')[0],
                                newUserId,
                                activity.timeSlot || activity.slot || '',
                                activity.type || activity.action || 'Activity',
                                activity.description || activity.details || '',
                                activity.totalPages || activity.metadata || '',
                                activity.pagesDone || activity.doneBy || '',
                                activity.timestamp || new Date().toISOString()
                            ]
                        );
                        activityCount++;
                        if (activityCount % 50 === 0) {
                            console.log(`   ✓ Migrated ${activityCount} activities...`);
                        }
                    } catch (err) {
                        console.error(`   ❌ Error migrating activity:`, err.message);
                    }
                }
                console.log(`✅ Migrated ${activityCount} activities\n`);

                // Migrate Leave Requests (if exists)
                console.log('🏖️  Migrating leave requests...');
                const leaveRequests = await new Promise((res, rej) => {
                    db.all('SELECT * FROM leave_requests', [], (err, rows) => {
                        if (err) {
                            console.log('   ℹ️  No leave_requests table found, skipping...');
                            res([]);
                        } else {
                            res(rows || []);
                        }
                    });
                });

                for (const leave of leaveRequests) {
                    try {
                        const newUserId = userIdMap.get(leave.userId);
                        if (!newUserId) continue;

                        await pool.query(
                            `INSERT INTO leave_requests (userId, startDate, endDate, reason, status, createdAt)
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [
                                newUserId,
                                leave.startDate,
                                leave.endDate,
                                leave.reason,
                                leave.status || 'pending',
                                leave.createdAt || new Date().toISOString()
                            ]
                        );
                    } catch (err) {
                        console.error(`   ❌ Error migrating leave request:`, err.message);
                    }
                }
                console.log(`✅ Migrated ${leaveRequests.length} leave requests\n`);

                // Migrate Permissions (if exists)
                console.log('🔐 Migrating permissions...');
                const permissions = await new Promise((res, rej) => {
                    db.all('SELECT * FROM permissions', [], (err, rows) => {
                        if (err) {
                            console.log('   ℹ️  No permissions table found, skipping...');
                            res([]);
                        } else {
                            res(rows || []);
                        }
                    });
                });

                for (const permission of permissions) {
                    try {
                        const newUserId = userIdMap.get(permission.userId);
                        if (!newUserId) continue;

                        await pool.query(
                            `INSERT INTO permissions (userId, date, startTime, endTime, reason, status, createdAt)
                             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                            [
                                newUserId,
                                permission.date,
                                permission.startTime,
                                permission.endTime,
                                permission.reason,
                                permission.status || 'pending',
                                permission.createdAt || new Date().toISOString()
                            ]
                        );
                    } catch (err) {
                        console.error(`   ❌ Error migrating permission:`, err.message);
                    }
                }
                console.log(`✅ Migrated ${permissions.length} permissions\n`);

                // Migrate Activity Log (if exists)
                console.log('📋 Migrating activity log...');
                const activityLogs = await new Promise((res, rej) => {
                    db.all('SELECT * FROM activity_log', [], (err, rows) => {
                        if (err) {
                            console.log('   ℹ️  No activity_log table found, skipping...');
                            res([]);
                        } else {
                            res(rows || []);
                        }
                    });
                });

                for (const log of activityLogs) {
                    try {
                        await pool.query(
                            `INSERT INTO activity_log (dateKey, employeeName, activityType, description, timeSlot, action, editedBy, timestamp, createdAt)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                            [
                                log.dateKey,
                                log.employeeName,
                                log.activityType,
                                log.description,
                                log.timeSlot,
                                log.action,
                                log.editedBy,
                                log.timestamp || new Date().toISOString(),
                                log.createdAt || new Date().toISOString()
                            ]
                        );
                    } catch (err) {
                        console.error(`   ❌ Error migrating activity log:`, err.message);
                    }
                }
                console.log(`✅ Migrated ${activityLogs.length} activity logs\n`);

                // Close connections
                db.close();
                await pool.end();

                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📊 Migration Summary:');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`✅ Users: ${users.length}`);
                console.log(`✅ Activities: ${activityCount}`);
                console.log(`✅ Leave Requests: ${leaveRequests.length}`);
                console.log(`✅ Permissions: ${permissions.length}`);
                console.log(`✅ Activity Logs: ${activityLogs.length}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                console.log('🎉 Migration completed successfully!\n');

                resolve();

            } catch (err) {
                console.error('❌ Migration error:', err);
                db.close();
                await pool.end();
                reject(err);
            }
        });
    });
}

migrateSQLiteToPostgres()
    .then(() => {
        console.log('✅ All data migrated successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    });
