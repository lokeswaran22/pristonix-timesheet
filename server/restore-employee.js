const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../database/timesheet.db');
const db = new sqlite3.Database(dbPath);

console.log('\n=== RESTORING EMPLOYEE: Lokeswaran ===\n');

// Restore the employee
const employeeData = {
    id: 4,
    name: 'Lokeswaran',
    username: 'lokeswaran.r@pristonix.com',
    password: 'lokeswaran123', // Default password - you may want to change this
    role: 'employee',
    email: 'lokeswaran.r@pristonix.com',
    createdAt: new Date().toISOString()
};

db.run(
    'INSERT INTO users (id, name, username, password, role, email, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [employeeData.id, employeeData.name, employeeData.username, employeeData.password, employeeData.role, employeeData.email, employeeData.createdAt],
    function (err) {
        if (err) {
            console.error('❌ Error restoring employee:', err);
        } else {
            console.log('✅ Successfully restored employee:');
            console.log(JSON.stringify(employeeData, null, 2));
        }

        db.close((err) => {
            if (err) console.error('Error closing database:', err);
            else console.log('\n=== Database closed ===\n');
        });
    }
);
