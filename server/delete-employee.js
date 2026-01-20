const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../database/timesheet.db');
const db = new sqlite3.Database(dbPath);

// Employee ID to delete
const employeeId = 4; // Lokeswaran

console.log(`\n=== DELETING EMPLOYEE ID: ${employeeId} ===\n`);

// First, show the employee details
db.get("SELECT id, name, username, role, email FROM users WHERE id = ?", [employeeId], (err, user) => {
    if (err) {
        console.error('Error fetching user:', err);
        db.close();
        return;
    }

    if (!user) {
        console.log(`❌ Employee with ID ${employeeId} not found.`);
        db.close();
        return;
    }

    console.log('Employee to be deleted:');
    console.log(JSON.stringify(user, null, 2));
    console.log('\n');

    // Delete associated data first (due to foreign key constraints)
    db.serialize(() => {
        // Delete activities
        db.run("DELETE FROM activities WHERE userId = ?", [employeeId], function (err) {
            if (err) console.error('Error deleting activities:', err);
            else console.log(`✓ Deleted ${this.changes} activities`);
        });

        // Delete leave requests
        db.run("DELETE FROM leave_requests WHERE userId = ?", [employeeId], function (err) {
            if (err) console.error('Error deleting leave requests:', err);
            else console.log(`✓ Deleted ${this.changes} leave requests`);
        });

        // Delete permission requests
        db.run("DELETE FROM permission_requests WHERE userId = ?", [employeeId], function (err) {
            if (err) console.error('Error deleting permission requests:', err);
            else console.log(`✓ Deleted ${this.changes} permission requests`);
        });

        // Delete activity log entries for this employee
        db.run("DELETE FROM activity_log WHERE employeeName = ?", [user.name], function (err) {
            if (err) console.error('Error deleting activity log:', err);
            else console.log(`✓ Deleted ${this.changes} activity log entries`);
        });

        // Finally, delete the user
        db.run("DELETE FROM users WHERE id = ?", [employeeId], function (err) {
            if (err) {
                console.error('❌ Error deleting user:', err);
            } else {
                console.log(`\n✅ Successfully deleted employee: ${user.name} (${user.username})`);
            }

            // Close the database
            db.close((err) => {
                if (err) console.error('Error closing database:', err);
                else console.log('\n=== Database closed ===\n');
            });
        });
    });
});
