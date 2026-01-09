// Add these methods to the TimesheetManager class after closeEmployeeActionModal()

showTimeSelectionForm(type) {
    this.currentActionType = type;

    // Hide action buttons
    document.getElementById('actionButtons').style.display = 'none';

    // Show time selection form
    const form = document.getElementById('timeSelectionForm');
    form.style.display = 'block';

    // Update title based on type
    const title = document.getElementById('timeSelectionTitle');
    const fullDayLabel = document.querySelector('#fullDayGroup label');

    if (type === 'leave') {
        title.textContent = 'Select Leave Time Range';
        fullDayLabel.innerHTML = '<input type="checkbox" id="fullDayCheck" style="width: 18px; height: 18px;"> Full Day Leave';
        document.getElementById('permissionReasonGroup').style.display = 'none';
    } else if (type === 'permission') {
        title.textContent = 'Select Permission Time Range';
        fullDayLabel.innerHTML = '<input type="checkbox" id="fullDayCheck" style="width: 18px; height: 18px;"> Full Day Permission';
        document.getElementById('permissionReasonGroup').style.display = 'block';
    } else if (type === 'holiday') {
        title.textContent = 'Select Holiday Time Range';
        fullDayLabel.innerHTML = '<input type="checkbox" id="fullDayCheck" style="width: 18px; height: 18px;"> Full Day Holiday';
        document.getElementById('permissionReasonGroup').style.display = 'none';
    }

    // Populate time slots
    const startSlot = document.getElementById('startSlot');
    const endSlot = document.getElementById('endSlot');

    startSlot.innerHTML = '';
    endSlot.innerHTML = '';

    this.timeSlots.forEach(slot => {
        const option1 = document.createElement('option');
        option1.value = slot;
        option1.textContent = slot;
        startSlot.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = slot;
        option2.textContent = slot;
        endSlot.appendChild(option2);
    });

    // Set end slot to last slot by default
    endSlot.selectedIndex = this.timeSlots.length - 1;

    // Handle full day checkbox
    const fullDayCheck = document.getElementById('fullDayCheck');
    fullDayCheck.addEventListener('change', (e) => {
        const isFull = e.target.checked;
        startSlot.disabled = isFull;
        endSlot.disabled = isFull;
    });
}

hideTimeSelectionForm() {
    document.getElementById('timeSelectionForm').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'flex';
}

async handleLeavePermissionSubmit() {
    const fullDay = document.getElementById('fullDayCheck').checked;
    const startSlot = document.getElementById('startSlot').value;
    const endSlot = document.getElementById('endSlot').value;
    const reason = document.getElementById('permissionReason')?.value || '';

    const dateKey = this.getDateKey(this.currentDate);
    const userId = this.actionUserId;

    if (!userId) {
        alert('Error: No user selected');
        return;
    }

    // Determine which slots to mark
    let slotsToMark = [];
    if (fullDay) {
        slotsToMark = [...this.timeSlots];
    } else {
        const startIdx = this.timeSlots.indexOf(startSlot);
        const endIdx = this.timeSlots.indexOf(endSlot);
        if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
            alert('Invalid time range');
            return;
        }
        slotsToMark = this.timeSlots.slice(startIdx, endIdx + 1);
    }

    // Determine activity type
    let activityType = '';
    let description = '';

    if (this.currentActionType === 'leave') {
        activityType = 'Leave';
        description = fullDay ? 'Full Day Leave' : `Leave (${startSlot} to ${endSlot})`;
    } else if (this.currentActionType === 'permission') {
        activityType = 'Permission';
        description = fullDay ? `Full Day Permission: ${reason}` : `Permission (${startSlot} to ${endSlot}): ${reason}`;
    } else if (this.currentActionType === 'holiday') {
        activityType = 'Holiday';
        description = fullDay ? 'Full Day Holiday' : `Holiday (${startSlot} to ${endSlot})`;
    }

    // Mark each slot
    for (const slot of slotsToMark) {
        try {
            const res = await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateKey,
                    userId,
                    timeSlot: slot,
                    type: activityType,
                    description,
                    startPage: 0,
                    endPage: 0
                })
            });

            if (!res.ok) {
                console.error(`Failed to mark ${slot}`);
            }
        } catch (e) {
            console.error(`Error marking ${slot}:`, e);
        }
    }

    // Close modal and refresh
    this.closeEmployeeActionModal();
    await this.loadData();
    this.renderTimesheet();
    this.showStatus(`${activityType} marked successfully`);
}

// Auto-mark Sundays as holidays
checkAndMarkSunday() {
    const day = this.currentDate.getDay();
    if (day === 0) { // Sunday
        // Add visual indicator that it's Sunday
        const dateDisplay = document.querySelector('.date-display');
        if (dateDisplay && !dateDisplay.textContent.includes('(Sunday)')) {
            dateDisplay.textContent += ' (Sunday - Holiday)';
            dateDisplay.style.color = '#10b981';
        }
    }
}
