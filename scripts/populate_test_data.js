const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/timesheet.db');
const db = new sqlite3.Database(dbPath);

const today = new Date().toISOString().split('T')[0];

console.log(`Populating Test Data for Date: ${today}`);

db.serialize(() => {
    // 1. Insert Dummy Activities (for Analytics)
    const stmt = db.prepare(`
        INSERT INTO activities (userId, dateKey, timeSlot, type, description, totalPages, pagesDone, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const samples = [
        { u: 1, s: '09:00-10:00', t: 'Epub', d: 'Chapter 1 Setup', p: '10' },
        { u: 1, s: '10:00-11:00', t: 'Proof', d: 'Reviewing Changes', p: '15' },
        { u: 1, s: '11:10-12:00', t: 'Epub', d: 'Formatting Fixes', p: '8' },
        { u: 2, s: '09:00-10:00', t: 'Calibr', d: 'Machine Calibration', p: '0' },
        { u: 2, s: '10:00-11:00', t: 'Other', d: 'Team Meeting', p: '0' }
    ];

    samples.forEach(s => {
        stmt.run(s.u, today, s.s, s.t, s.d, '20', s.p, new Date().toISOString());
    });
    stmt.finalize();
    console.log(`Added ${samples.length} dummy activities.`);

    // 2. Insert Dummy Audit Logs (for History Page)
    const logStmt = db.prepare(`
        INSERT INTO activity_history (user_id, action_type, action_by, date_key, time_slot, old_data, new_data, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, '127.0.0.1', 'Mozilla/Test-Agent')
    `);

    // Simulate Create Logs
    samples.forEach(s => {
        const newData = JSON.stringify({ type: s.t, description: s.d, pagesDone: s.p });
        logStmt.run(s.u, 'CREATE', 1, today, s.s, null, newData);
    });

    // Simulate a Delete Log
    const oldData = JSON.stringify({ type: 'Mistake', description: 'Deleted item', pagesDone: '5' });
    logStmt.run(1, 'DELETE', 1, today, '12:00-01:00', oldData, null);

    logStmt.finalize();
    console.log('Added dummy audit logs.');
});

db.close((err) => {
    if (err) console.error(err.message);
    else console.log('Database Connection Closed. Data Populated.');
});
