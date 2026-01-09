// Create audit log table for activity history tracking
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../database/timesheet.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Create activity_history table
    db.run(`
        CREATE TABLE IF NOT EXISTS activity_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id INTEGER,
            user_id INTEGER NOT NULL,
            action_type VARCHAR(20) NOT NULL,
            action_by INTEGER NOT NULL,
            action_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            old_data TEXT,
            new_data TEXT,
            date_key VARCHAR(10) NOT NULL,
            time_slot VARCHAR(20) NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (action_by) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('✅ activity_history table created successfully!');
        }
    });

    // Create indexes for better query performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_activity_history_user ON activity_history(user_id)`, () => {
        console.log('✅ User index created');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_activity_history_date ON activity_history(date_key)`, () => {
        console.log('✅ Date index created');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_activity_history_action ON activity_history(action_type)`, () => {
        console.log('✅ Action type index created');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_activity_history_timestamp ON activity_history(action_timestamp)`, () => {
        console.log('✅ Timestamp index created');
        console.log('\n🎉 Audit log database setup complete!');
        db.close();
    });
});
