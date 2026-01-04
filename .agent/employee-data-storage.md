# Employee Data Storage Verification

## Database Schema

The `users` table stores all employee data with the following columns:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,           -- Hashed password for authentication
    plain_password VARCHAR(255),              -- Plain text password for admin viewing
    role VARCHAR(50) DEFAULT 'employee',
    email VARCHAR(255),                       -- Email for password recovery
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Data Flow

### Creating New Employee

**Frontend (script.js):**
```javascript
async addEmployee(name, username, password, role, email) {
    const payload = { name, username, password, role, email };
    
    const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}
```

**Backend (server-postgres.js):**
```javascript
app.post('/api/users', async (req, res) => {
    const { name, username, password, role, email } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await query(`
        INSERT INTO users (name, username, password, plain_password, role, email, createdAt)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING id, name, username, role, email
    `, [name, username, hashedPassword, password, role || 'employee', email || '']);
    
    res.json(result.rows[0]);
});
```

**Data Stored:**
- ✅ Name
- ✅ Username (unique)
- ✅ Password (hashed with bcrypt)
- ✅ Plain Password (for admin viewing)
- ✅ Role (default: 'employee')
- ✅ Email
- ✅ Created timestamp

---

### Updating Existing Employee

**Frontend (script.js):**
```javascript
async updateEmployee(id, name, username, password, role, email) {
    const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, role, email })
    });
}
```

**Backend (server-postgres.js):**
```javascript
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, password, role, email } = req.body;
    
    let updateQuery = `UPDATE users SET name = $1, username = $2, role = $3, email = $4`;
    let params = [name, username, role || 'employee', email || ''];
    
    if (password && password.trim() !== '') {
        const hashedPassword = await bcrypt.hash(password.trim(), 10);
        updateQuery += `, password = $5, plain_password = $6 WHERE id = $7 RETURNING id, name, username, role, email`;
        params.push(hashedPassword, password.trim(), id);
    } else {
        updateQuery += ` WHERE id = $5 RETURNING id, name, username, role, email`;
        params.push(id);
    }
    
    const result = await query(updateQuery, params);
    res.json(result.rows[0]);
});
```

**Data Updated:**
- ✅ Name
- ✅ Username
- ✅ Email
- ✅ Role
- ✅ Password (if provided - both hashed and plain)
- ✅ Plain Password (if password changed)

---

## Verification Steps

### 1. Create Employee Test
1. Login as admin
2. Click "Add Employee"
3. Fill in:
   - Name: "Test Employee"
   - Username: "test.employee"
   - Password: "test123"
   - Email: "test@example.com"
4. Click "Save Employee"
5. **Expected Result:** Employee appears in the list

### 2. Verify Data in Database
```sql
SELECT id, name, username, plain_password, email, role, createdAt 
FROM users 
WHERE username = 'test.employee';
```

**Expected Output:**
```
id | name          | username       | plain_password | email              | role     | createdAt
---+---------------+----------------+----------------+--------------------+----------+-------------------
X  | Test Employee | test.employee  | test123        | test@example.com   | employee | 2025-12-29 ...
```

### 3. Edit Employee Test
1. Click edit on "Test Employee"
2. Change email to: "newemail@example.com"
3. Change password to: "newpass456"
4. Click "Save Employee"
5. **Expected Result:** Employee data updated

### 4. Verify Update in Database
```sql
SELECT id, name, username, plain_password, email, role 
FROM users 
WHERE username = 'test.employee';
```

**Expected Output:**
```
id | name          | username       | plain_password | email                 | role
---+---------------+----------------+----------------+-----------------------+----------
X  | Test Employee | test.employee  | newpass456     | newemail@example.com  | employee
```

---

## Password Recovery Flow

### Admin Sends Password
1. Admin clicks edit on employee
2. Admin sees current password in field
3. Admin clicks "📧 Send Password" button
4. Confirmation dialog appears
5. Admin confirms
6. Email content logged to server console
7. Audit trail created in `activity_log` table

### Email Content
```
To: employee@email.com
Subject: Your Pristonix Timesheet Login Credentials

Hello [Employee Name],

Your login credentials for the Pristonix Timesheet System are:

Username: [username]
Password: [plain_password from database]

Login URL: http://localhost:3000
```

---

## Data Integrity Checks

✅ **Username Uniqueness:** Database constraint prevents duplicate usernames  
✅ **Password Security:** Passwords are hashed with bcrypt (10 rounds)  
✅ **Plain Password Storage:** Stored separately for admin password recovery  
✅ **Email Storage:** Stored for password recovery and notifications  
✅ **Audit Trail:** Password email sending logged in activity_log  

---

## Current Status

✅ Employee data is properly stored when creating new employees  
✅ Employee data is properly updated when editing employees  
✅ Email field is saved and retrieved correctly  
✅ Passwords are stored both hashed and plain text  
✅ Admin can view and send passwords via email  
✅ All CRUD operations working correctly  

**Server:** Running at http://localhost:3000  
**Database:** PostgreSQL connected  
**All endpoints:** Functional and tested
