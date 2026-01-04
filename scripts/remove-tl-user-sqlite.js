const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/timesheet.db');

console.log('🔌 Connecting to SQLite database...');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to database\n');
    removeTLUsers();
});

function removeTLUsers() {
    console.log('🗑️  Removing Team Leader users and associated data...');

    // First, get the TL users
    db.all("SELECT id, name, username, role FROM users WHERE username = 'tl@pristonix' OR role = 'tl'", [], (err, users) => {
        if (err) {
            console.error('❌ Error finding TL users:', err.message);
            db.close();
            process.exit(1);
        }

        if (users.length === 0) {
            console.log('ℹ️  No TL users found in database');
            verifyUsers();
            return;
        }

        console.log('✅ Found TL users to remove:');
        users.forEach(user => {
            console.log(`   - ${user.name} (${user.username}) - Role: ${user.role}`);
        });

        // Delete TL users
        db.run("DELETE FROM users WHERE username = 'tl@pristonix' OR role = 'tl'", [], function (err) {
            if (err) {
                console.error('❌ Error deleting TL users:', err.message);
                db.close();
                process.exit(1);
            }

            console.log(`✅ Removed ${this.changes} user(s)`);
            verifyUsers();
        });
    });
}

function verifyUsers() {
    console.log('\n🔍 Verifying remaining users...');
    db.all('SELECT id, name, username, role, email FROM users ORDER BY id', [], (err, users) => {
        if (err) {
            console.error('❌ Error querying users:', err.message);
            db.close();
            process.exit(1);
        }

        console.log('📋 Users in database:');
        if (users.length === 0) {
            console.log('   (No users found)');
        } else {
            users.forEach(user => {
                console.log(`   ${user.id}. ${user.name} (${user.username}) - Role: ${user.role}`);
            });
        }

        db.close((err) => {
            if (err) {
                console.error('❌ Error closing database:', err.message);
            } else {
                console.log('\n✅ TL user removal completed successfully!\n');
            }
        });
    });
}
