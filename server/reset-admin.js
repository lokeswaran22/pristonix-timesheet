const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, '../database/timesheet.db');
const db = new sqlite3.Database(dbPath);

// Check admin users
db.all("SELECT id, name, username, role FROM users WHERE role = 'admin'", (err, rows) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    console.log('\n=== Admin Users in Database ===');
    console.log(rows);
    console.log('\nTotal admin users:', rows.length);

    // Update both admin passwords
    const adminPassword = '!pristonixadmin#@2026';
    const guestPassword = '#guestuser';

    bcrypt.hash(adminPassword, 10, (err, adminHash) => {
        if (err) {
            console.error('Hash error:', err);
            db.close();
            return;
        }

        bcrypt.hash(guestPassword, 10, (err, guestHash) => {
            if (err) {
                console.error('Hash error:', err);
                db.close();
                return;
            }

            // Update admin@pristonix
            db.run(
                "UPDATE users SET password = ? WHERE username = 'admin@pristonix'",
                [adminHash],
                function (err) {
                    if (err) {
                        console.error('Admin update error:', err);
                    } else {
                        console.log('\n✅ Master Admin password updated!');
                        console.log('   Username: admin@pristonix');
                        console.log('   Password: !pristonixadmin#@2026');
                        console.log('   Rows affected:', this.changes);
                    }

                    // Update guest@pristonix
                    db.run(
                        "UPDATE users SET password = ? WHERE username = 'guest@pristonix'",
                        [guestHash],
                        function (err) {
                            if (err) {
                                console.error('Guest update error:', err);
                            } else {
                                console.log('\n✅ Guest Admin password updated!');
                                console.log('   Username: guest@pristonix');
                                console.log('   Password: #guestuser');
                                console.log('   Rows affected:', this.changes);
                            }
                            db.close();
                        }
                    );
                }
            );
        });
    });
});
