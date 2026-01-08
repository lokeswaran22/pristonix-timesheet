const { Pool } = require('pg');
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

async function verifyData() {
    try {
        console.log('🔌 Connecting to PostgreSQL...');
        await pool.connect();
        console.log('✅ Connected to database\n');

        // Check users
        const users = await pool.query('SELECT id, name, username, role FROM users ORDER BY id');
        console.log('👥 Users in PostgreSQL:');
        users.rows.forEach(user => {
            console.log(`   ${user.id}. ${user.name} (${user.username}) - Role: ${user.role}`);
        });
        console.log(`   Total: ${users.rows.length} users\n`);

        // Check activities
        const activities = await pool.query('SELECT COUNT(*) as count FROM activities');
        console.log(`📝 Activities: ${activities.rows[0].count}`);

        // Show sample activities
        const sampleActivities = await pool.query(`
            SELECT a.*, u.username 
            FROM activities a 
            JOIN users u ON a.userId = u.id 
            ORDER BY a.id 
            LIMIT 5
        `);

        console.log('\n📊 Sample activities:');
        sampleActivities.rows.forEach((row, i) => {
            console.log(`\n${i + 1}. Activity ID: ${row.id}`);
            console.log(`   User: ${row.username}`);
            console.log(`   Date: ${row.datekey}`);
            console.log(`   Time Slot: ${row.timeslot}`);
            console.log(`   Type: ${row.type}`);
            console.log(`   Description: ${row.description}`);
        });

        // Check activity logs
        const activityLogs = await pool.query('SELECT COUNT(*) as count FROM activity_log');
        console.log(`\n\n📋 Activity Logs: ${activityLogs.rows[0].count}`);

        // Check leave requests
        const leaveRequests = await pool.query('SELECT COUNT(*) as count FROM leave_requests');
        console.log(`🏖️  Leave Requests: ${leaveRequests.rows[0].count}`);

        await pool.end();
        console.log('\n✅ Verification complete!\n');

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
        process.exit(1);
    }
}

verifyData();
