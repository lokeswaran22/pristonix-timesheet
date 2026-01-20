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

async function removeTLUser() {
    let client;
    try {
        console.log('🔌 Connecting to PostgreSQL...');
        client = await pool.connect();
        console.log('✅ Connected to database\n');

        // Delete TL user and all associated data
        console.log('🗑️  Removing Team Leader user and associated data...');

        const result = await client.query(`
            DELETE FROM users 
            WHERE username = 'tl@pristonix' OR role = 'tl'
            RETURNING id, name, username
        `);

        if (result.rows.length > 0) {
            console.log('✅ Removed users:');
            result.rows.forEach(user => {
                console.log(`   - ${user.name} (${user.username})`);
            });
        } else {
            console.log('ℹ️  No TL users found in database');
        }

        // Verify remaining users
        console.log('\n🔍 Verifying remaining users...');
        const users = await client.query('SELECT id, name, username, role, email FROM users ORDER BY id');
        console.log('📋 Users in database:');
        users.rows.forEach(user => {
            console.log(`   ${user.id}. ${user.name} (${user.username}) - Role: ${user.role}`);
        });

        client.release();
        await pool.end();
        console.log('\n✅ TL user removal completed successfully!\n');

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
        if (client) client.release();
        await pool.end();
        process.exit(1);
    }
}

removeTLUser();
