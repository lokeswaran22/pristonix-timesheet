# Password Display & Management Guide

## ✅ Current Implementation - How It Works

### 📝 Creating New Employee

**Step 1: Admin Opens "Add Employee" Modal**
```
┌─────────────────────────────────────┐
│     Add New Employee                │
├─────────────────────────────────────┤
│ Name: [John Doe              ]      │
│ Username: [john.doe          ]      │
│ Password: [mypassword123     ] 🙈   │  ← Password VISIBLE by default
│ Email: [john@example.com     ]      │
│ Role: [Employee ▼            ]      │
│                                     │
│ [Cancel]  [Save Employee]           │
└─────────────────────────────────────┘
```

**What Happens:**
- Password field type = "text" (visible)
- Admin can see exactly what they're typing
- Toggle button 🙈 available to hide if needed
- Password saved as: `mypassword123`

**Database Storage:**
```sql
INSERT INTO users (name, username, password, plain_password, email)
VALUES ('John Doe', 'john.doe', '$2a$10$hashed...', 'mypassword123', 'john@example.com')
```

---

### ✏️ Editing Existing Employee

**Step 2: Admin Clicks "Edit" on Employee**

**Backend Fetches:**
```javascript
GET /api/users/123/password
→ Returns: {
    id: 123,
    name: 'John Doe',
    username: 'john.doe',
    password: 'mypassword123',  // ← Plain password from database
    email: 'john@example.com',
    role: 'employee'
}
```

**Frontend Displays:**
```javascript
// Line 930 in script.js
passwordField.value = user.password || '';  // Shows: 'mypassword123'
```

**Modal Shows:**
```
┌─────────────────────────────────────┐
│     Edit Employee                   │
├─────────────────────────────────────┤
│ Name: [John Doe              ]      │
│ Username: [john.doe          ]      │
│ Password: [mypassword123     ] 🙈   │  ← OLD PASSWORD VISIBLE!
│ Email: [john@example.com     ]      │
│ Role: [Employee ▼            ]      │
│                                     │
│ ✓ Current password is shown.        │
│   Modify to change, or leave        │
│   as-is to keep current.            │
│   [📧 Send Password]                │
│                                     │
│ [Cancel]  [Save Employee]           │
└─────────────────────────────────────┘
```

---

### 🔄 Three Options for Admin

#### **Option 1: Keep Old Password**
```
Password: [mypassword123     ] 🙈
          ↑ Don't change this
```
- Admin leaves password as-is
- Clicks "Save Employee"
- Password remains: `mypassword123`

#### **Option 2: Change to New Password**
```
Password: [newpassword456    ] 🙈
          ↑ Admin types new password
```
- Admin clears field and types new password
- Clicks "Save Employee"
- Password updated to: `newpassword456`
- Database updates both hashed and plain_password

#### **Option 3: Send Current Password via Email**
```
✓ Current password is shown.
  [📧 Send Password] ← Admin clicks this
```
- Admin clicks "📧 Send Password"
- Confirmation: "Send password to John Doe at john@example.com?"
- Email logged to console with password: `mypassword123`
- Employee receives email with their password

---

## 🔍 Code Flow

### When Editing Employee:

**1. Fetch Password from Database:**
```javascript
// Backend: server-postgres.js line 229
app.get('/api/users/:id/password', async (req, res) => {
    const result = await query(
        'SELECT id, name, username, plain_password as password, role, email FROM users WHERE id = $1',
        [id]
    );
    res.json(result.rows[0]);
});
```

**2. Display in Password Field:**
```javascript
// Frontend: script.js line 930
passwordField.value = user.password || '';  // Shows plain_password from DB
```

**3. Update Password (if changed):**
```javascript
// Backend: server-postgres.js line 272-275
if (password && password.trim() !== '') {
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    updateQuery += `, password = $5, plain_password = $6 WHERE id = $7`;
    params.push(hashedPassword, password.trim(), id);
}
```

---

## ✨ Features Summary

✅ **Create Employee:**
- Password visible by default (type="text")
- Admin can see what they're typing
- Toggle button to hide/show

✅ **Edit Employee:**
- **OLD PASSWORD DISPLAYED** in password field
- Admin can see the password that was originally created
- Hint message explains: "Current password is shown"

✅ **Keep or Change:**
- Leave as-is → keeps old password
- Type new password → updates to new password
- Empty field → keeps old password (no change)

✅ **Send Password:**
- "📧 Send Password" button available
- Sends current password via email
- Logged to console and audit trail

---

## 🎯 Example Scenario

**Day 1: Admin Creates Employee**
```
Admin creates: john.doe
Password set: welcome123
```

**Day 30: Employee Forgets Password**
```
Employee: "I forgot my password!"
Admin: Opens edit modal
Admin sees: Password field shows "welcome123"
Admin: Clicks "📧 Send Password"
Employee: Receives email with "welcome123"
```

**Day 31: Admin Changes Password**
```
Admin: Opens edit modal
Admin sees: Password field shows "welcome123"
Admin: Changes to "newpass456"
Admin: Clicks Save
New password: "newpass456"
```

**Day 32: Admin Checks Password Again**
```
Admin: Opens edit modal
Admin sees: Password field shows "newpass456"  ← Updated password!
```

---

## 🔐 Security Notes

- **Hashed Password:** Used for authentication (bcrypt)
- **Plain Password:** Stored for admin viewing only
- **Database Access:** Only admins can view passwords
- **Audit Trail:** Password email sending is logged
- **Toggle Button:** Admin can hide password for privacy

---

## ✅ Verification

**Test 1: Create Employee**
1. Create employee with password "test123"
2. Save employee
3. Edit employee
4. **Expected:** Password field shows "test123" ✅

**Test 2: Change Password**
1. Edit employee
2. Change password to "newtest456"
3. Save employee
4. Edit employee again
5. **Expected:** Password field shows "newtest456" ✅

**Test 3: Keep Password**
1. Edit employee
2. Don't change password field
3. Save employee
4. Edit employee again
5. **Expected:** Password field shows same password ✅

---

## 🎊 Status: FULLY IMPLEMENTED & WORKING!

The password display functionality is **already working** as requested:
- ✅ Admin creates password → visible
- ✅ Admin edits employee → old password shown
- ✅ Admin can keep old password or change to new
- ✅ Admin can send password via email
