const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database/timesheet.db', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }

    console.log('✅ Connected to SQLite database\n');

    // Get all tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error('Error getting tables:', err.message);
            db.close();
            return;
        }

        console.log('📋 Tables in database:');
        tables.forEach(table => {
            console.log(`   - ${table.name}`);
        });
        console.log('');

        // Get users count
        db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
            if (err) {
                console.error('Error counting users:', err.message);
            } else {
                console.log(`👥 Users: ${row.count}`);
            }

            // Get activities count
            db.get("SELECT COUNT(*) as count FROM activities", [], (err, row) => {
                if (err) {
                    console.error('Error counting activities:', err.message);
                } else {
                    console.log(`📝 Activities: ${row.count}`);
                }

                // Show sample activities
                db.all("SELECT * FROM activities LIMIT 5", [], (err, rows) => {
                    if (err) {
                        console.error('Error getting activities:', err.message);
                    } else {
                        console.log('\n📊 Sample activities:');
                        rows.forEach((row, i) => {
                            console.log(`\n${i + 1}. Activity ID: ${row.id}`);
                            console.log(`   User ID: ${row.userId}`);
                            console.log(`   Date: ${row.dateKey}`);
                            console.log(`   Time Slot: ${row.timeSlot}`);
                            console.log(`   Type: ${row.type}`);
                            console.log(`   Description: ${row.description}`);
                        });
                    }

                    // Show all users
                    db.all("SELECT * FROM users", [], (err, rows) => {
                        if (err) {
                            console.error('Error getting users:', err.message);
                        } else {
                            console.log('\n\n👥 All users:');
                            rows.forEach((user) => {
                                console.log(`   ${user.id}. ${user.name} (${user.username}) - Role: ${user.role}`);
                            });
                        }

                        db.close();
                    });
                });
            });
        });
    });
});
