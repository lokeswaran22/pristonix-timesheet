const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetDatabase() {
    console.log('🔄 Resetting database...');

    try {
        // Drop all tables in reverse order (to handle foreign keys)
        console.log('Dropping existing tables...');
        await pool.query('DROP TABLE IF EXISTS reminders CASCADE');
        await pool.query('DROP TABLE IF EXISTS activity_log CASCADE');
        await pool.query('DROP TABLE IF EXISTS permissions CASCADE');
        await pool.query('DROP TABLE IF EXISTS leave_requests CASCADE');
        await pool.query('DROP TABLE IF EXISTS activities CASCADE');
        await pool.query('DROP TABLE IF EXISTS users CASCADE');

        console.log('✅ All tables dropped successfully');
        console.log('✅ Database reset complete');
        console.log('🚀 Now restart the server with: npm start');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error resetting database:', err);
        process.exit(1);
    }
}

resetDatabase();
