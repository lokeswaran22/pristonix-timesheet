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

async function createAdminUser() {
    try {
        console.log('🔌 Connecting to PostgreSQL...');
        await pool.connect();
        console.log('✅ Connected to database');

        // Check if admin user exists
        const checkResult = await pool.query('SELECT * FROM users WHERE username = $1', ['admin@pristonix']);

        if (checkResult.rows.length > 0) {
            console.log('👤 Admin user already exists. Resetting password...');

            // Reset password
            const adminPassword = '!pristonixadmin#@2026';
            const hashedPassword = await bcrypt.hash(adminPassword, 10);

            await pool.query(
                'UPDATE users SET password = $1, role = $2 WHERE username = $3',
                [hashedPassword, 'admin', 'admin@pristonix']
            );

            console.log('✅ Admin password reset successfully!');
        } else {
            console.log('👤 Creating new admin user...');

            // Create new admin user
            const adminUsername = 'admin@pristonix';
            const adminPassword = '!pristonixadmin#@2026';
            const hashedPassword = await bcrypt.hash(adminPassword, 10);

            await pool.query(`
                INSERT INTO users (name, username, password, role, email)
                VALUES ($1, $2, $3, $4, $5)
            `, ['Master Admin', adminUsername, hashedPassword, 'admin', 'admin@pristonix.com']);

            console.log('✅ Admin user created successfully!');
        }

        // Display credentials
        console.log('\n🔐 Admin Login Credentials:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Username: admin@pristonix');
        console.log('Password: !pristonixadmin#@2026');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Verify the user was created/updated
        const verifyResult = await pool.query('SELECT id, name, username, role, email FROM users WHERE username = $1', ['admin@pristonix']);

        if (verifyResult.rows.length > 0) {
            console.log('✅ Verification successful:');
            console.log(verifyResult.rows[0]);
        } else {
            console.log('❌ Verification failed - user not found');
        }

        await pool.end();
        console.log('\n✅ Done!');

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
        process.exit(1);
    }
}

createAdminUser();
