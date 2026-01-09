# Employee Password Update Fix

## Problem Description
When updating an employee's information (like username or name), the password field was required. This caused two issues:
1. Admins had to re-enter a password even when they just wanted to update other fields
2. If they left it blank, the form wouldn't submit due to HTML5 validation
3. This created confusion about whether the password was being lost or not

## Root Cause
The password input field in `index.html` had a hardcoded `required` attribute, which meant it was always mandatory - both when creating new employees AND when editing existing ones.

## Solution Implemented

### 1. Frontend Changes (JavaScript)
**File**: `public/js/script.js`
**Function**: `openEmployeeModal(userId)`

Added dynamic password field handling:
- **When ADDING a new employee**: Password field is required (sets `required` attribute)
- **When EDITING an existing employee**: Password field is optional (removes `required` attribute)
- Added helpful placeholder text: "Leave blank to keep current password"

```javascript
if (userId) {
    // Edit mode - password optional
    if (passwordField) {
        passwordField.removeAttribute('required');
        passwordField.placeholder = 'Leave blank to keep current password';
    }
} else {
    // Add mode - password required
    if (passwordField) {
        passwordField.setAttribute('required', 'required');
        passwordField.placeholder = 'Enter password';
    }
}
```

### 2. HTML Changes
**File**: `public/index.html`

Removed the hardcoded `required` attribute from the password field, allowing JavaScript to control it dynamically:

```html
<!-- Before -->
<input type="password" id="employeePassword" ... required>

<!-- After -->
<input type="password" id="employeePassword" ...>
```

### 3. Backend Verification
**File**: `server/server-sqlite.js`
**Endpoint**: `PUT /api/users/:id`

The backend was already correctly implemented! It only updates the password if one is provided:

```javascript
if (password && password.trim() !== '') {
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    query += ', password = ?';
    params.push(hashedPassword);
}
```

## How It Works Now

### Creating a New Employee
1. Click "Add Employee"
2. Fill in Name, Username, **Password** (required), Role
3. Click "Save Employee"
4. ✅ Employee created with hashed password

### Updating an Existing Employee
1. Click on employee name or edit button
2. Modify Name, Username, or Role
3. **Leave password field blank** to keep existing password
4. OR enter a new password to change it
5. Click "Save Employee"
6. ✅ Employee updated, password preserved (if blank) or changed (if provided)

## Testing Steps

1. **Test Create Employee**:
   - Add a new employee with username "test.user" and password "test123"
   - Verify you can log in with these credentials

2. **Test Update Without Password Change**:
   - Edit the employee, change name to "Test User Updated"
   - Leave password field blank
   - Save changes
   - Log out and log back in with original password "test123"
   - ✅ Should work - password preserved

3. **Test Update With Password Change**:
   - Edit the employee again
   - Enter new password "newpass456"
   - Save changes
   - Log out and try logging in with "newpass456"
   - ✅ Should work - password updated

## Files Modified
1. `public/js/script.js` - Added dynamic password field handling
2. `public/index.html` - Removed hardcoded required attribute

## No Breaking Changes
- Existing functionality remains intact
- Backend API unchanged
- Database schema unchanged
- All existing employees and passwords unaffected
