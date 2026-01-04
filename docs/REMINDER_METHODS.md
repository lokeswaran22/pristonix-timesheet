// Add these methods to TimesheetManager class

isTimeSlotPast(slot) {
    const now = new Date();
    const [, endTime] = slot.split('-');
    const endHour = parseInt(endTime.split(':')[0]);
    return now.getHours() >= endHour;
}

isCurrentTimeSlot(slot) {
    const now = new Date();
    const currentHour = now.getHours();
    const [startTime, endTime] = slot.split('-');
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    return currentHour >= startHour && currentHour < endHour;
}

checkAndShowReminders() {
    if (this.currentUser.role !== 'employee') return;
    
    const dateKey = this.getDateKey(this.currentDate);
    const userId = this.currentUser.id;
    const userActivities = this.activities[dateKey]?.[userId] || {};
    
    let emptyPastSlots = 0;
    this.timeSlots.forEach(slot => {
        if (this.isTimeSlotPast(slot) && !userActivities[slot]) {
            emptyPastSlots++;
        }
    });
    
    if (emptyPastSlots > 0) {
        this.showReminderBadge(emptyPastSlots);
    } else {
        this.hideReminderBadge();
    }
}

showReminderBadge(count) {
    let badge = document.getElementById('reminder-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'reminder-badge';
        badge.className = 'reminder-badge';
        document.body.appendChild(badge);
        
        badge.addEventListener('click', () => {
            alert(`You have ${count} unfilled time slot${count > 1 ? 's' : ''}. Please fill them to complete your timesheet.`);
        });
    }
    
    badge.innerHTML = `
        <span>⚠️</span>
        <span>Unfilled Slots</span>
        <span class="reminder-count">${count}</span>
    `;
    badge.style.display = 'flex';
}

hideReminderBadge() {
    const badge = document.getElementById('reminder-badge');
    if (badge) {
        badge.style.display = 'none';
    }
}

// Call this after rendering timesheet
// Add to renderTimesheet() method:
// this.checkAndShowReminders();
