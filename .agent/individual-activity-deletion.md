# Individual Activity Deletion - Complete Implementation

## Feature Overview

Users can now **delete individual activities** instead of deleting all activities in a time slot at once. This provides much better control and user experience.

## What Changed

### Before
- If you had 3 activities in one time slot, clicking "Delete" would remove ALL 3 activities
- No way to remove just one specific activity
- Had to delete everything and re-add what you wanted to keep

### After
- ✅ See a list of all activities in the time slot
- ✅ Delete individual activities one by one
- ✅ "Clear All" button to delete everything at once (if needed)
- ✅ Each activity has its own delete button

## How It Works

### 1. Single Activity in Time Slot
- Shows the activity details in the form
- **Delete** button at the bottom removes that one activity

### 2. Multiple Activities in Time Slot
- Shows a **list of all activities** at the top of the modal
- Each activity in the list has its own **Delete** button
- **Clear All** button at the bottom removes all activities at once
- Form shows the most recent activity for editing

### Example UI

```
┌─────────────────────────────────────────────┐
│ Add Activity - 9:00-10:00                   │
├─────────────────────────────────────────────┤
│                                             │
│ Existing Activities in this slot:          │
│ ┌─────────────────────────────────────┐   │
│ │ [EPUB] Chapter 1 (25 pages) [Delete]│   │
│ │ [PROOF] Review pages (10 pages) [Delete]│
│ │ [EPUB] Chapter 2 (30 pages) [Delete]│   │
│ └─────────────────────────────────────┘   │
│                                             │
│ Activity Type: [Epub Process ▼]            │
│ Description: [________________]             │
│ ...                                         │
│                                             │
│ [Cancel] [Save Activity] [Clear All]       │
└─────────────────────────────────────────────┘
```

## Implementation Details

### Frontend Changes

**File**: `public/js/script.js`

#### 1. Modified `openActivityModal()` (line ~1181-1268)
- Detects if multiple activities exist
- Creates a visual list of all activities
- Adds individual delete buttons for each activity
- Changes main delete button text to "Clear All" when multiple activities exist

#### 2. Added `deleteIndividualActivity()` (line ~1397-1462)
- New function to delete a specific activity by index
- Confirms deletion with user
- Calls new backend API endpoint
- Refreshes the modal to show updated list
- Updates local cache

### Backend Changes

**File**: `server/server-postgres.js`

#### Added New Endpoint: `DELETE /api/activities/individual` (line ~381-425)

**Request Body**:
```json
{
  "dateKey": "2025-12-31",
  "userId": 5,
  "timeSlot": "9:00-10:00",
  "activityIndex": 1
}
```

**How it works**:
1. Fetches all activities for the time slot (ordered by ID)
2. Selects the activity at the specified index
3. Deletes only that specific activity by its ID
4. Returns success message

**Response**:
```json
{
  "message": "Activity deleted",
  "deletedId": 123
}
```

## User Experience Flow

### Scenario: Employee has 3 activities in 9:00-10:00 slot

1. **Click the time slot** → Modal opens
2. **See the list**:
   - EPUB: Chapter 1 (25 pages) [Delete]
   - PROOF: Review (10 pages) [Delete]
   - EPUB: Chapter 2 (30 pages) [Delete]
3. **Click Delete on "PROOF: Review"**
4. **Confirm** → "Delete PROOF activity: 'Review'?"
5. **Activity removed** → List updates to show only 2 activities
6. **Modal stays open** → Can continue managing activities

### Scenario: Employee has 1 activity

1. **Click the time slot** → Modal opens
2. **No list shown** → Just the form with activity details
3. **Delete button** at bottom (not "Clear All")
4. **Click Delete** → Removes the activity
5. **Modal closes** → Time slot is now empty

## Testing Steps

1. **Refresh browser** at http://localhost:3000
2. Log in as employee
3. Click a time slot
4. **Add first activity**:
   - Type: Epub Process
   - Description: Chapter 1
   - Pages: 1-25
   - Click "Save & Add Another"
5. **Add second activity**:
   - Type: Proof Reading
   - Description: Review
   - Pages: 1-10
   - Click "Save & Add Another"
6. **Add third activity**:
   - Type: Epub Process
   - Description: Chapter 2
   - Pages: 26-55
   - Click "Save Activity"
7. **Reopen the time slot**
8. ✅ **You should see**:
   - List of 3 activities at the top
   - Each with its own Delete button
   - "Clear All" button at the bottom
9. **Click Delete on the middle activity** (Proof Reading)
10. ✅ **Confirm deletion**
11. ✅ **List updates** to show only 2 activities
12. **Click "Clear All"**
13. ✅ **All activities removed**

## API Endpoints

### Delete Individual Activity
- **Endpoint**: `DELETE /api/activities/individual`
- **Body**: `{ dateKey, userId, timeSlot, activityIndex }`
- **Use**: Delete one specific activity

### Delete All Activities (existing)
- **Endpoint**: `DELETE /api/activities`
- **Body**: `{ dateKey, userId, timeSlot }`
- **Use**: Clear all activities in a time slot

## Benefits

✅ **Granular Control**: Delete only what you want
✅ **Better UX**: See all activities at once
✅ **No Data Loss**: Don't have to delete everything to fix one mistake
✅ **Visual Feedback**: Clear list shows what's in the slot
✅ **Flexible**: Can still clear all at once if needed
✅ **Intuitive**: Each activity has its own delete button

## Files Modified

1. **public/js/script.js**:
   - Modified `openActivityModal()` to show activity list
   - Added `deleteIndividualActivity()` function
   - Updated delete button behavior

2. **server/server-postgres.js**:
   - Added `DELETE /api/activities/individual` endpoint
   - Handles deletion by activity index

## Server Status

✅ Server restarted and running at **http://localhost:3000**
✅ New endpoint active and ready
✅ Frontend changes ready (refresh browser to load)
