# Edit Individual Activities - Complete Implementation

## Feature Overview

Users can now **edit individual activities** using the Edit button next to each activity in the list. This provides full CRUD (Create, Read, Update, Delete) functionality for activities.

## What's New

### ✅ Edit Button Added
- Each activity in the list now has an **Edit** button (blue) next to the Delete button (red)
- Click Edit to load that specific activity into the form
- Make changes and click "Update Activity" to save

### ✅ Smart Form Behavior
- **Editing Mode**: Button says "Update Activity" (green)
- **Normal Mode**: Button says "Save Activity" (blue)
- **Cancel Edit**: New button appears to cancel editing and return to list

## User Interface

```
┌─────────────────────────────────────────────────────┐
│ Add Activity - 9:00-10:00                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Existing Activities in this slot:                  │
│ ┌───────────────────────────────────────────────┐ │
│ │ [EPUB] Chapter 1 (25 pages) [Edit] [Delete]  │ │
│ │ [PROOF] Review (10 pages)   [Edit] [Delete]  │ │
│ │ [EPUB] Chapter 2 (30 pages) [Edit] [Delete]  │ │
│ └───────────────────────────────────────────────┘ │
│                                                     │
│ Activity Type: [Epub Process ▼]                    │
│ Description: [________________]                     │
│ Start Page: [__] End Page: [__] Total: [__]        │
│ ...                                                 │
│                                                     │
│ [Cancel] [Cancel Edit] [Update Activity] [Clear All]│
└─────────────────────────────────────────────────────┘
```

## How It Works

### 1. **View Activities**
- Open a time slot with multiple activities
- See the list of all activities at the top

### 2. **Click Edit**
- Click the blue **Edit** button next to any activity
- The form loads with that activity's data
- Button changes to green "Update Activity"
- "Cancel Edit" button appears

### 3. **Make Changes**
- Modify the activity type, description, pages, etc.
- All fields are editable

### 4. **Save Changes**
- Click "Update Activity"
- Old activity is deleted
- New activity is saved
- List refreshes automatically

### 5. **Cancel Editing**
- Click "Cancel Edit" to discard changes
- Returns to normal view with activity list

## Implementation Details

### Frontend Changes

**File**: `public/js/script.js`

#### 1. Updated Activity List (line ~1226-1237)
- Added Edit button next to Delete button
- Both buttons wrapped in a flex container
- Edit button is blue (#3b82f6)
- Delete button is red (#ef4444)

#### 2. Added `editIndividualActivity()` Function (line ~1469-1554)
- Loads selected activity data into form
- Hides the activity list temporarily
- Changes button text to "Update Activity"
- Adds "Cancel Edit" button
- Stores `editingActivityIndex` to track which activity is being edited

#### 3. Modified `handleActivitySubmit()` (line ~1855-1903)
- Checks if `editingActivityIndex` is set
- If editing:
  - Saves new activity data
  - Deletes old activity by index
  - Resets editing state
  - Refreshes the modal with updated list
- If not editing:
  - Normal save behavior (adds new activity)

### Backend

No backend changes needed! Uses the existing `DELETE /api/activities/individual` endpoint.

## User Experience Flow

### Scenario: Edit the second activity

1. **Open time slot** with 3 activities
2. **Click Edit** on "PROOF: Review (10 pages)"
3. **Form loads** with:
   - Type: Proof Reading
   - Description: Review
   - Pages: 1-10
4. **Change description** to "Review and corrections"
5. **Change pages** to 1-15
6. **Click "Update Activity"**
7. **Activity updated**:
   - Old "Review (10 pages)" is removed
   - New "Review and corrections (15 pages)" is added
8. **List refreshes** showing the updated activity

### Scenario: Cancel editing

1. **Click Edit** on an activity
2. **Make some changes**
3. **Click "Cancel Edit"**
4. **Changes discarded**, returns to list view
5. **Original activity unchanged**

## Button States

### Normal State (No Editing)
- **Save Activity** (blue) - Adds new activity
- **Save & Add Another** (green) - Adds and keeps modal open
- **Delete** / **Clear All** (red) - Removes activities

### Editing State
- **Update Activity** (green) - Saves changes to edited activity
- **Cancel Edit** (gray) - Cancels editing, returns to list
- **Cancel** (gray) - Closes modal
- **Delete** / **Clear All** (red) - Still available

## Features

✅ **Edit Any Activity**: Click Edit on any activity in the list
✅ **Visual Feedback**: Button changes color and text when editing
✅ **Cancel Option**: Discard changes without saving
✅ **Auto-Refresh**: List updates after editing
✅ **Preserve Data**: Other activities remain untouched
✅ **Smart UI**: Form adapts based on editing state

## Testing Steps

1. **Refresh browser** at http://localhost:3000
2. Log in as employee
3. Click a time slot
4. **Add 2-3 activities** using "Save & Add Another"
5. Close and reopen the time slot
6. ✅ **See Edit and Delete buttons** for each activity
7. **Click Edit** on the second activity
8. ✅ **Form loads** with that activity's data
9. ✅ **Button says "Update Activity"** (green)
10. ✅ **"Cancel Edit" button** appears
11. **Change the description**
12. **Click "Update Activity"**
13. ✅ **Activity updated** in the list
14. **Click Edit** on another activity
15. **Click "Cancel Edit"**
16. ✅ **Changes discarded**, list unchanged

## Files Modified

1. **public/js/script.js**:
   - Line ~1226-1237: Added Edit button to activity list
   - Line ~1469-1554: Added `editIndividualActivity()` function
   - Line ~1855-1903: Modified `handleActivitySubmit()` to handle editing

## Benefits

✅ **Full CRUD**: Create, Read, Update, Delete all supported
✅ **Intuitive**: Edit button right next to each activity
✅ **Safe**: Cancel option prevents accidental changes
✅ **Efficient**: No need to delete and re-add
✅ **Visual**: Clear indication of editing mode
✅ **Flexible**: Edit any activity at any time

## Summary

Now you have complete control over your activities:
- **Add** new activities
- **View** all activities in a slot
- **Edit** individual activities ← NEW!
- **Delete** individual activities
- **Clear All** to remove everything

The Edit feature makes it easy to fix mistakes or update information without having to delete and recreate activities! 🎉
