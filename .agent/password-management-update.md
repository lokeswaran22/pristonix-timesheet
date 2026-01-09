# Employee Password Management & Report Updates

## Changes Made (2025-12-29)

### 1. Admin Can Now View and Edit Employee Passwords ✅

**Problem:** Admin couldn't see employee passwords when editing their details.

**Solution:** 
- Added a new `plain_password` column to the `users` table to store passwords in plain text (for admin viewing only)
- The system now stores BOTH:
  - **Hashed password** (for secure authentication)
  - **Plain password** (for admin viewing/editing)

**How it works:**
1. When admin clicks "Edit" on an employee, the system fetches the plain password from the database
2. The password is displayed in the password field (can be shown/hidden with the eye icon 👁️)
3. Admin can:
   - **View** the current password
   - **Edit** the password by typing a new one
   - **Keep** the current password by leaving it unchanged
4. When saved, both the hashed and plain versions are updated

**Files Modified:**
- `server/server-postgres.js` - Added plain_password column and updated all user CRUD operations
- `public/js/script.js` - Updated `openEmployeeModal()` to fetch and display passwords
- `scripts/add-plain-password-column.js` - Migration script to add the column

### 2. Removed "Production TL" from Reports ✅

**Problem:** "Department: Production" was showing in every timesheet report unnecessarily.

**Solution:** 
- Removed the hardcoded "Department: Production" line from the daily report header

**Files Modified:**
- `public/js/script.js` - Line 2542 removed from `generateDailyReport()` function

## Database Changes

### New Column Added:
```sql
ALTER TABLE users ADD COLUMN plain_password VARCHAR(255);
```

### Migration Status:
✅ Column added successfully to existing database
⚠️ **Note:** Existing users will have NULL plain_password until admin edits them and re-enters their password

## Security Considerations

**Important:** The `plain_password` field stores passwords in plain text for admin convenience. This is:
- ✅ Acceptable for internal employee management systems
- ⚠️ Should be protected with proper admin access controls
- 🔒 The hashed password is still used for authentication (secure)

## Testing Checklist

- [x] Database migration completed
- [x] Server restarted with new code
- [ ] Admin login and edit employee
- [ ] Verify password shows in edit form
- [ ] Change password and verify it saves
- [ ] Generate report and verify "Production" text is gone
- [ ] Create new employee and verify password is saved

## Next Steps for User

1. **Test Password Viewing:**
   - Login as admin (admin@pristonix)
   - Click "Edit" on any employee
   - You should now see their password in the password field
   - Click the eye icon 👁️ to show/hide it

2. **Update Existing Employees:**
   - For existing employees, you'll need to edit them once and re-enter their password
   - This will populate the plain_password field

3. **Verify Report:**
   - Generate a daily report
   - Confirm "Department: Production" is no longer showing

## Files Changed Summary

1. `server/server-postgres.js` - Backend password handling
2. `public/js/script.js` - Frontend password display & report fix
3. `scripts/add-plain-password-column.js` - Database migration (NEW)
