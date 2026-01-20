// Add this method to TimesheetManager class after saveDefaultLunch()

async saveSundayHoliday(userId, dateKey, timeSlot) {
    try {
        await fetch('/api/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dateKey,
                userId,
                timeSlot,
                type: 'sunday-holiday',
                description: 'Sunday Holiday',
                startPage: 0,
                endPage: 0
            })
        });
    } catch (e) {
        console.error('Error saving Sunday holiday:', e);
    }
}

// Add this code in renderEmployeeVerticalView() after the lunch auto-fill logic (around line 414)

// Auto-fill Sunday as Holiday for all slots
const currentDay = this.currentDate.getDay();
if (currentDay === 0) { // Sunday
    const sundayKey = `sunday_saved_${dateKey}_${user.id}`;
    const sundayAlreadySaved = sessionStorage.getItem(sundayKey);
    
    if (!sundayAlreadySaved) {
        // Initialize if needed
        if (!this.activities[dateKey]) this.activities[dateKey] = {};
        if (!this.activities[dateKey][user.id]) this.activities[dateKey][user.id] = {};
        
        // Mark all time slots as Sunday Holiday
        this.timeSlots.forEach(slot => {
            if (!this.activities[dateKey][user.id][slot]) {
                this.activities[dateKey][user.id][slot] = [{
                    type: 'sunday-holiday',
                    description: 'Sunday Holiday',
                    pagesDone: '0',
                    timestamp: new Date().toISOString()
                }];
                
                // Save to backend
                this.saveSundayHoliday(user.id, dateKey, slot);
            }
        });
        
        sessionStorage.setItem(sundayKey, 'true');
    }
}
