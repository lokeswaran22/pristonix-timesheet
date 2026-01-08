const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addPlainPasswordColumn() {
    try {
        console.log('🔧 Adding plain_password column to users table...');

        // Add column if it doesn't exist
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS plain_password VARCHAR(255);
        `);

        console.log('✅ Column added successfully');
        console.log('⚠️  Note: Existing users will have NULL plain_password until they update their password');
        console.log('💡 Admins can edit each user and re-enter their password to populate this field');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

addPlainPasswordColumn();
