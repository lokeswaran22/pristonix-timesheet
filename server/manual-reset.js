const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = path.resolve(__dirname, '../database/timesheet.db');
const db = new sqlite3.Database(dbPath);

const username = 'admin@pristonix';

db.get("SELECT id, username FROM users WHERE username = ?", [username], (err, user) => {
    if (err || !user) {
        console.error('User not found');
        return;
    }

    // Generate Token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    db.run(
        'INSERT INTO password_resets (userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?)',
        [user.id, token, expiresAt, new Date().toISOString()],
        function (err) {
            if (err) {
                console.error('Error creating token');
            } else {
                console.log(`\nHere is your manual reset link for ${username}:`);
                console.log(`http://localhost:3000/reset-password.html?token=${token}`);
                console.log('\n(Copy and paste this into your browser)');
            }
            db.close();
        }
    );
});
