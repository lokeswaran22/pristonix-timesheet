const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
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

async function importExcelData(excelFilePath) {
    try {
        console.log('🔌 Connecting to PostgreSQL...');
        await pool.connect();
        console.log('✅ Connected to database\n');

        // Read Excel file
        console.log(`📖 Reading Excel file: ${excelFilePath}`);
        const workbook = XLSX.readFile(excelFilePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`📊 Found ${data.length} rows to import\n`);

        if (data.length === 0) {
            console.log('⚠️  No data found in Excel file');
            await pool.end();
            return;
        }

        // Get or create users
        const userMap = new Map();

        console.log('👥 Processing users...');
        for (const row of data) {
            const username = row.User || row.user || row.USERNAME;
            if (username && !userMap.has(username)) {
                // Check if user exists
                const userCheck = await pool.query(
                    'SELECT id, username FROM users WHERE username = $1',
                    [username]
                );

                if (userCheck.rows.length > 0) {
                    userMap.set(username, userCheck.rows[0].id);
                    console.log(`   ✓ Found existing user: ${username} (ID: ${userCheck.rows[0].id})`);
                } else {
                    // Create new user with employee role
                    const newUser = await pool.query(
                        `INSERT INTO users (name, username, password, role, email) 
                         VALUES ($1, $2, $3, $4, $5) 
                         RETURNING id`,
                        [
                            username.split('@')[0] || username,
                            username,
                            '$2a$10$defaultPasswordHash', // Default password hash
                            'employee',
                            username.includes('@') ? username : `${username}@pristonix.com`
                        ]
                    );
                    userMap.set(username, newUser.rows[0].id);
                    console.log(`   + Created new user: ${username} (ID: ${newUser.rows[0].id})`);
                }
            }
        }

        console.log(`\n✅ Processed ${userMap.size} unique users\n`);

        // Import activities
        console.log('📝 Importing activities...');
        let importedCount = 0;
        let skippedCount = 0;

        for (const row of data) {
            try {
                const username = row.User || row.user || row.USERNAME;
                const timeSlot = row.Time || row.Slot || row.SLOT || row.time;
                const action = row.Action || row.action || row.ACTION;
                const details = row.Details || row.details || row.DETAILS;
                const doneBy = row['Done By'] || row.DoneBy || row.DONE_BY;
                const metadata = row.Metadata || row.metadata || row.METADATA;

                if (!username || !timeSlot) {
                    console.log(`   ⚠️  Skipping row - missing required fields`);
                    skippedCount++;
                    continue;
                }

                const userId = userMap.get(username);
                if (!userId) {
                    console.log(`   ⚠️  Skipping row - user not found: ${username}`);
                    skippedCount++;
                    continue;
                }

                // Extract date from Time field or use current date
                let dateKey = new Date().toISOString().split('T')[0];
                if (row.Time) {
                    const timeStr = row.Time.toString();
                    // Try to parse date from various formats
                    const dateMatch = timeStr.match(/(\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) {
                        dateKey = dateMatch[1];
                    }
                }

                // Insert activity
                await pool.query(
                    `INSERT INTO activities (dateKey, userId, timeSlot, type, description, totalPages, pagesDone, timestamp)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                    [
                        dateKey,
                        userId,
                        timeSlot,
                        action || 'Activity',
                        details || '',
                        metadata || '',
                        doneBy || ''
                    ]
                );

                importedCount++;
                if (importedCount % 10 === 0) {
                    console.log(`   ✓ Imported ${importedCount} activities...`);
                }

            } catch (err) {
                console.error(`   ❌ Error importing row:`, err.message);
                skippedCount++;
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Import Summary:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Successfully imported: ${importedCount} activities`);
        console.log(`⚠️  Skipped: ${skippedCount} rows`);
        console.log(`👥 Users processed: ${userMap.size}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await pool.end();
        console.log('✅ Import completed successfully!\n');

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
        process.exit(1);
    }
}

// Get Excel file path from command line argument
const excelFilePath = process.argv[2];

if (!excelFilePath) {
    console.error('❌ ERROR: Please provide the path to the Excel file');
    console.log('\nUsage: node import-excel-data.js <path-to-excel-file>');
    console.log('Example: node import-excel-data.js ./data/activities.xlsx\n');
    process.exit(1);
}

// Check if file exists
const fs = require('fs');
if (!fs.existsSync(excelFilePath)) {
    console.error(`❌ ERROR: File not found: ${excelFilePath}\n`);
    process.exit(1);
}

importExcelData(excelFilePath);
