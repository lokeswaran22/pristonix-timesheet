const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/timesheet.db');
const db = new sqlite3.Database(dbPath);

const NEW_PIN = '20265';

db.serialize(() => {
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('admin_pin', ?)", [NEW_PIN], (err) => {
        if (err) {
            console.error('Error updating PIN:', err);
        } else {
            console.log(`Successfully updated admin_pin to ${NEW_PIN}`);

            // Verify
            db.get("SELECT value FROM system_settings WHERE key = 'admin_pin'", (err, row) => {
                if (row) console.log('Verified stored PIN:', row.value);
            });
        }
    });
});

db.close();
