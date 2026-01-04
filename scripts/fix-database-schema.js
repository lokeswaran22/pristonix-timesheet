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

async function fixDatabaseSchema() {
    let client;
    try {
        console.log('🔌 Connecting to PostgreSQL...');
        client = await pool.connect();
        console.log('✅ Connected to database\n');

        // Check if users table exists
        console.log('🔍 Checking users table...');
        const tableCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);

        if (tableCheck.rows.length > 0) {
            console.log('📋 Current users table structure:');
            tableCheck.rows.forEach(col => {
                console.log(`   - ${col.column_name} (${col.data_type})`);
            });
            console.log('');

            // Check if username column exists
            const hasUsername = tableCheck.rows.some(col => col.column_name === 'username');

            if (!hasUsername) {
                console.log('⚠️  Username column is missing! Dropping and recreating table...\n');

                // Drop dependent tables first
                console.log('🗑️  Dropping dependent tables...');
                await client.query('DROP TABLE IF EXISTS reminders CASCADE');
                await client.query('DROP TABLE IF EXISTS permissions CASCADE');
                await client.query('DROP TABLE IF EXISTS leave_requests CASCADE');
                await client.query('DROP TABLE IF EXISTS activities CASCADE');
                await client.query('DROP TABLE IF EXISTS activity_log CASCADE');
                await client.query('DROP TABLE IF EXISTS users CASCADE');
                console.log('✅ Old tables dropped\n');
            }
        }

        // Create users table with correct schema
        console.log('📝 Creating users table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'employee',
                email VARCHAR(255),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table created\n');

        // Create activities table
        console.log('📝 Creating activities table...');
        await client.query(`
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
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_activities_date_user 
            ON activities(dateKey, userId)
        `);
        console.log('✅ Activities table created\n');

        // Create leave_requests table
        console.log('📝 Creating leave_requests table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS leave_requests (
                id SERIAL PRIMARY KEY,
                userId INTEGER NOT NULL,
                startDate VARCHAR(255),
                endDate VARCHAR(255),
                reason TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_leave_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Leave requests table created\n');

        // Create permissions table
        console.log('📝 Creating permissions table...');
        await client.query(`
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
            )
        `);
        console.log('✅ Permissions table created\n');

        // Create activity_log table
        console.log('📝 Creating activity_log table...');
        await client.query(`
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
            )
        `);
        console.log('✅ Activity log table created\n');

        // Create reminders table
        console.log('📝 Creating reminders table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS reminders (
                id SERIAL PRIMARY KEY,
                userId INTEGER NOT NULL,
                dateKey VARCHAR(255) NOT NULL,
                message TEXT,
                sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sentBy VARCHAR(255),
                status VARCHAR(50) DEFAULT 'sent',
                CONSTRAINT fk_reminder_user FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Reminders table created\n');

        // Create admin user
        console.log('👤 Creating admin user...');
        const adminUsername = 'admin@pristonix';
        const adminPassword = '!pristonixadmin@2025';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        await client.query(`
            INSERT INTO users (name, username, password, role, email)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (username) DO UPDATE 
            SET password = EXCLUDED.password, role = EXCLUDED.role
        `, ['Master Admin', adminUsername, hashedPassword, 'admin', 'admin@pristonix.com']);
        console.log('✅ Admin user created\n');

        // Verify users
        console.log('🔍 Verifying users...');
        const users = await client.query('SELECT id, name, username, role, email FROM users ORDER BY id');
        console.log('📋 Users in database:');
        users.rows.forEach(user => {
            console.log(`   ${user.id}. ${user.name} (${user.username}) - Role: ${user.role}`);
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔐 Login Credentials:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Admin:');
        console.log('  Username: admin@pristonix');
        console.log('  Password: !pristonixadmin@2025');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        client.release();
        await pool.end();
        console.log('✅ Database schema fixed successfully!');
        console.log('🚀 You can now restart the server and login\n');

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
        if (client) client.release();
        await pool.end();
        process.exit(1);
    }
}

fixDatabaseSchema();
