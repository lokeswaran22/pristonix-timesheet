// ==========================================
// DATA MANAGEMENT
// ==========================================

class TimesheetManager {
    constructor() {
        this.employees = []; // Now refers to users with role='employee' + 'admin'
        this.activities = {};
        this.currentDate = new Date();
        this.editingUserId = null;
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

        this.timeSlots = [
            '9:00-10:00', '10:00-11:00', '11:00-11:10', '11:10-12:00',
            '12:00-01:00', '01:00-01:40', '01:40-03:00', '03:00-03:50',
            '03:50-04:00', '04:00-05:00', '05:00-06:00'
        ];

        // Ensure UI updates periodically for time-based styling
        setInterval(() => this.updateTimeSlotStyles(), 60000); // Check every minute
        this.init();
    }

    async init() {
        if (!this.currentUser.id) {
            window.location.href = 'login.html';
            return;
        }

        console.log('TimesheetManager initializing...');
        this.setupEventListeners();
        this.setDateInput();
        this.startHourlyReminder();
        await this.loadData();
        this.handleRoleBasedUI();
        this.renderTimesheet();
        this.handlePreloader();
        this.checkPendingReminders(); // Check for any pending reminders

        // Request Notification Permission
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }

        // Poll for notifications every 15 seconds
        setInterval(() => this.checkPendingReminders(), 15000);
    }

    handlePreloader() {
        const preloader = document.getElementById('preloader');
        if (!preloader) return;
        const hasLoadedBefore = sessionStorage.getItem('hasLoadedBefore');
        if (hasLoadedBefore) {
            preloader.style.display = 'none';
        } else {
            sessionStorage.setItem('hasLoadedBefore', 'true');
            setTimeout(() => {
                preloader.classList.add('hide');
                setTimeout(() => { preloader.style.display = 'none'; }, 800);
            }, 1000);
        }
    }

    handleRoleBasedUI() {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const role = this.currentUser.role;
        const isAdmin = role === 'admin';
        const isManagement = isAdmin;

        // Check for restricted "Guest" admin accounts
        const isRestrictedAdmin = (this.currentUser.username === 'admin2' || this.currentUser.username === 'guest@pristonix');

        console.log(`Role UI Update: Role=${role}, User=${this.currentUser.username}, Restricted=${isRestrictedAdmin}`);

        // Initialize Management Features if Management
        if (isManagement) {
            if (!this.historyManager && window.HistoryManager) {
                // Defer slightly to ensure DOM is ready
                setTimeout(() => {
                    this.historyManager = new window.HistoryManager();
                    // Load data immediately
                    this.historyManager.loadLogs();
                    this.historyManager.loadDashboardAnalytics();
                }, 100);
            }
        }

        // Display styles
        const managementStyle = isManagement ? 'inline-flex' : 'none';
        const employeeOnlyStyle = isManagement ? 'none' : 'inline-flex';

        // Admin/TL Buttons
        // "Add Employee" is strictly for full admins, NOT restricted ones
        const addBtn = document.getElementById('addEmployeeBtn');
        if (addBtn) addBtn.style.display = (isManagement && !isRestrictedAdmin) ? 'inline-flex' : 'none';

        // Export PDF - Visible for everyone
        const exportPdfBtn = document.getElementById('exportPdfBtn');
        if (exportPdfBtn) exportPdfBtn.style.display = 'inline-flex';

        // Admin Panel Link - Full admins only (not restricted supervisors)
        const adminBtn = document.getElementById('adminPanelToggleBtn');
        if (adminBtn) {
            adminBtn.style.display = (isManagement && !isRestrictedAdmin) ? 'inline-flex' : 'none';
            adminBtn.onclick = () => window.location.href = 'history.html';
        }

        // Check Missing (Management/Notifications) - Available for all admins including supervisors
        const checkMissingBtn = document.getElementById('checkMissingBtn');
        if (checkMissingBtn) checkMissingBtn.style.display = managementStyle;

        // Quick Actions - Admin Only (hide for restricted admins)
        const adminQuickActions = document.getElementById('adminQuickActions');
        if (adminQuickActions) adminQuickActions.style.display = (isAdmin && !isRestrictedAdmin) ? 'flex' : 'none';

        // Analytics Sidebar / Recent Changes - Show for Everyone (Filtered for Employees)
        const analyticsSection = document.getElementById('adminAnalyticsSection');
        if (analyticsSection) {
            // RESTORED: Visible for all, content filtered by ActivityTracker based on role
            analyticsSection.style.display = 'block';
        }

        // Hide "Audit Log" button for non-admins and restricted admins
        const auditLogBtn = document.getElementById('adminAnalyticsControls');
        if (auditLogBtn) {
            auditLogBtn.style.display = (isAdmin && !isRestrictedAdmin) ? 'flex' : 'none';
        }

        if (isManagement) this.loadDashboardAnalytics(); // This loads the sidebar stats if any
        // Digital Clock (Employee Mode only)
        const digitalClock = document.getElementById('digitalClock');
        if (digitalClock) digitalClock.style.display = employeeOnlyStyle;

        if (!isManagement) {
            document.body.classList.add('employee-view');
        } else {
            document.body.classList.remove('employee-view');
        }
    }

    async loadDashboardAnalytics() {
        // Prevent redundant loads if recently loaded? Or just always load refresh.
        // Role check is redundant but safe
        if (!this.currentUser || this.currentUser.role !== 'admin') return;

        const date = new Date().toISOString().split('T')[0]; // Today

        try {
            const [sumRes, chartRes] = await Promise.all([
                fetch(`/api/analytics/summary?date=${date}`),
                fetch(`/api/analytics/charts?date=${date}`)
            ]);

            if (sumRes.ok) {
                const summary = await sumRes.json();
                const elEmp = document.getElementById('dashStatEmp');
                const elAct = document.getElementById('dashStatAct');
                const elPages = document.getElementById('dashStatPages');
                if (elEmp) elEmp.textContent = summary.employees;
                if (elAct) elAct.textContent = summary.activities;
                if (elPages) elPages.textContent = summary.totalPages;
            }

            if (chartRes.ok) {
                const data = await chartRes.json();
                this.renderDashboardCharts(data);
            }
        } catch (e) { console.error('Dashboard Error', e); }
    }

    renderDashboardCharts(data) {
        // Destroy old if exists
        if (window.dashCharts) {
            window.dashCharts.forEach(c => c.destroy());
        }
        window.dashCharts = [];

        const ctx1 = document.getElementById('dashProdChart');
        const ctx2 = document.getElementById('dashTypeChart');

        // Safety check if elements exist
        if (!ctx1 || !ctx2) return;

        const baseColor = '#1e3a8a';

        // 1. Bar Chart
        window.dashCharts.push(new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: data.productivity.map(d => d.name),
                datasets: [{
                    label: 'Pages',
                    data: data.productivity.map(d => d.totalPages),
                    backgroundColor: baseColor,
                    borderRadius: 4
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        }));

        // 2. Doughnut Chart
        window.dashCharts.push(new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: data.distribution.map(d => d.type),
                datasets: [{
                    data: data.distribution.map(d => d.count),
                    backgroundColor: ['#1e3a8a', '#d4af37', '#10b981', '#ef4444', '#f59e0b']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        }));
    }

    setDateInput() {
        const dateInput = document.getElementById('dateInput'); // Changed from 'dateSelect' to 'dateInput'
        if (dateInput) {
            dateInput.value = this.getDateKey(this.currentDate);

            // Listener for date change
            dateInput.addEventListener('change', async (e) => {
                this.currentDate = new Date(e.target.value);
                await this.loadData();
                this.renderTimesheet();
                // Refresh activity tracker for the new date
                const dateKey = this.getDateKey(this.currentDate);
                window.activityTracker?.loadLogs(dateKey);
            });
        }
        const display = document.getElementById('currentDateDisplay');
        if (display) {
            display.textContent = this.currentDate.toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
        }
    }

    getDateKey(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    showStatus(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : '#10b981'};
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // API Methods
    async loadData() {
        try {
            // Fetch Users (which acts as employees list)
            // If employee, backend might still return all users, but we filter in UI
            // Admin needs all users.
            const [userRes, actRes] = await Promise.all([
                fetch('/api/users?t=' + Date.now()),
                fetch(`/api/activities?dateKey=${this.getDateKey(this.currentDate)}&t=${Date.now()}`)
            ]);

            if (!userRes.ok || !actRes.ok) throw new Error('Failed to fetch data');

            this.employees = await userRes.json();
            this.activities = await actRes.json(); // Format: { dateKey: { userId: { timeSlot: [act1, act2] } } }

            // Reload Activity Log for this date
            if (window.activityTracker) {
                window.activityTracker.loadLogs(this.getDateKey(this.currentDate));
            }

            // Validate Session - if current user does not exist in DB (e.g. after DB reset), logout
            const userExists = this.employees.some(u => u.id == this.currentUser.id);
            if (!userExists && this.employees.length > 0) {
                console.warn('Current user not found in database. Session invalid.');
                localStorage.removeItem('currentUser');
                window.location.href = 'login.html';
                return;
            }

            // Re-render timesheet after data is loaded
            this.renderTimesheet();

        } catch (e) {
            console.error('Error loading data:', e);
            this.showStatus('Error connecting to server', 'error');
        }
    }

    // ... (rest of Date/User methods same)

    // Activity Methods
    getActivity(userId, timeSlot, date = this.currentDate) {
        const dateKey = this.getDateKey(date);
        // Returns Array or null
        return this.activities[dateKey]?.[userId]?.[timeSlot] || null;
    }

    async setActivity(userId, timeSlot, activityData, date = this.currentDate) {
        const dateKey = this.getDateKey(date);
        const payload = { dateKey, userId, timeSlot, ...activityData };

        console.log('Saving activity:', payload); // Debug log

        try {
            const res = await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const responseData = await res.json();

                if (!this.activities[dateKey]) this.activities[dateKey] = {};
                if (!this.activities[dateKey][userId]) this.activities[dateKey][userId] = {};
                if (!this.activities[dateKey][userId][timeSlot]) this.activities[dateKey][userId][timeSlot] = [];

                // Push new activity with returned ID
                this.activities[dateKey][userId][timeSlot].push({
                    ...activityData,
                    id: responseData.id
                });

                if (window.activityTracker) {
                    const employee = this.employees.find(emp => emp.id == userId);
                    if (employee) {
                        // Include Date in log slot display
                        const logSlot = `${dateKey} | ${timeSlot}`; // e.g. "2025-12-11 | 9:00-10:00"
                        // Pass explicit dateKey as 6th argument
                        // Changed from employee.username to employee.name for consistency
                        window.activityTracker.addActivity(employee.name, activityData.type, activityData.description, logSlot, 'updated', dateKey);
                    }
                }
                this.renderTimesheet();
                this.showStatus('Activity saved successfully!');
                console.log('Activity saved successfully with ID:', responseData.id);
            } else {
                const errorData = await res.json();
                console.error('Failed to save activity:', errorData);
                this.showStatus('Failed to save activity: ' + (errorData.error || 'Unknown error'), 'error');
            }
        } catch (err) {
            console.error('Error saving activity:', err);
            this.showStatus('Error saving activity: ' + err.message, 'error');
        }
    }


    // ... (skip clearActivity update for brevity, assume clear wipes slot)

    // ...

    renderTimesheet() {
        const tbody = document.getElementById('timesheetBody');
        tbody.innerHTML = '';

        const role = this.currentUser.role;
        const isAdmin = role === 'admin';
        const isManagement = isAdmin;
        const isRestrictedAdmin = (this.currentUser.username === 'admin2' || this.currentUser.username === 'guest@pristonix');

        // Hide Actions column header for restricted admins
        const actionsHeader = document.querySelector('.timesheet-table thead th:last-child');
        if (actionsHeader && actionsHeader.textContent.includes('Actions')) {
            actionsHeader.style.display = (isManagement && !isRestrictedAdmin) ? '' : 'none';
        }

        // For employees, render vertical view
        if (!isManagement) {
            this.renderEmployeeVerticalView();
            return;
        }

        // Filter: Admin sees all users except other admins
        let usersToShow = this.employees.filter(u => u.role !== 'admin');

        if (usersToShow.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100%">No employees found.</td></tr>';
            return;
        }

        // Sort by name
        usersToShow.sort((a, b) => a.name.localeCompare(b.name));

        // Pre-process Auto-fills (Lunch & Sunday) for Admin Table View
        const dateKey = this.getDateKey(this.currentDate);
        const lunchSlot = '01:00-01:40';
        const currentDay = this.currentDate.getDay();

        usersToShow.forEach(user => {
            if (!this.activities[dateKey]) this.activities[dateKey] = {};
            if (!this.activities[dateKey][user.id]) this.activities[dateKey][user.id] = {};

            // Lunch check
            if (currentDay !== 0 && !this.activities[dateKey][user.id][lunchSlot]) {
                this.activities[dateKey][user.id][lunchSlot] = [{
                    type: 'lunch-break', description: 'Lunch Break', pagesDone: '0', timestamp: new Date().toISOString()
                }];
                const lunchKey = `lunch_saved_${dateKey}_${user.id}`;
                if (!sessionStorage.getItem(lunchKey)) {
                    this.saveDefaultLunch(user.id, dateKey, lunchSlot);
                    sessionStorage.setItem(lunchKey, 'true');
                }
            }

            // Sunday check
            if (currentDay === 0) {
                const sundayKey = `sunday_saved_${dateKey}_${user.id}`;
                if (!sessionStorage.getItem(sundayKey)) {
                    this.timeSlots.forEach(slot => {
                        if (!this.activities[dateKey][user.id][slot]) {
                            this.activities[dateKey][user.id][slot] = [{
                                type: 'sunday-holiday', description: 'Sunday Holiday', pagesDone: '0', timestamp: new Date().toISOString()
                            }];
                            this.saveSundayHoliday(user.id, dateKey, slot);
                        }
                    });
                    sessionStorage.setItem(sundayKey, 'true');
                }
            }
        });

        usersToShow.forEach(user => {
            const row = document.createElement('tr');

            // Name Column
            const nameTd = document.createElement('td');
            nameTd.className = 'sticky-col';
            nameTd.textContent = user.name;
            if (isAdmin || user.id == this.currentUser.id) {
                nameTd.style.cursor = 'pointer';
                nameTd.onclick = () => this.openEmployeeActionModal(user.id, user.name);
            }
            row.appendChild(nameTd);

            // Activity Counters (Proof, Epub, etc)
            // Calculate totals
            let proof = 0, epub = 0, calibr = 0;
            const slots = this.activities[this.getDateKey(this.currentDate)]?.[user.id] || {};

            // Check full day leave (simplified check on first slot)
            const firstSlotActs = slots[this.timeSlots[0]]; // Array now
            const isLeave = (firstSlotActs && firstSlotActs.length > 0 && firstSlotActs[0].type === 'leave' && firstSlotActs[0].description === 'FULL_DAY_LEAVE');

            if (!isLeave) {
                // Iterate all slots
                Object.values(slots).forEach(actList => { // actList is Array
                    if (Array.isArray(actList)) {
                        actList.forEach(act => {
                            const p = parseInt(act.pagesDone) || 0;
                            if (act.type === 'proof') proof += p;
                            if (act.type === 'epub') epub += p;
                            if (act.type === 'calibr') calibr += p;
                        });
                    }
                });
            }

            // Stats Cols
            [proof, epub, calibr].forEach((val, idx) => {
                const td = document.createElement('td');
                td.className = `sub-col ${['proof', 'epub', 'calibr'][idx]}-col`;
                td.textContent = val || '-';
                if (val) td.style.fontWeight = 'bold';
                row.appendChild(td);
            });

            // Time Slots
            if (isLeave) {
                const td = document.createElement('td');
                td.colSpan = this.timeSlots.length;
                td.className = 'full-day-leave-cell';
                td.textContent = 'ON LEAVE';
                row.appendChild(td);
            } else {
                this.timeSlots.forEach(slot => {
                    const td = document.createElement('td');
                    td.appendChild(this.createActivityCell(user.id, slot));
                    row.appendChild(td);
                });
            }

            // Actions (Admin Only - Not for restricted admins)
            const isRestrictedAdmin = (this.currentUser.username === 'admin2' || this.currentUser.username === 'guest@pristonix');

            if (isManagement && !isRestrictedAdmin) {
                const actionTd = document.createElement('td');
                let buttons = '';

                // Edit - Strictly Admin
                if (isAdmin) {
                    buttons += `<button class="icon-btn edit-btn" title="Edit User">✎</button>`;
                }

                // Delete - Admin & TL (Management)
                buttons += `<button class="icon-btn del-btn" title="Delete User">🗑</button>`;

                actionTd.innerHTML = buttons;

                if (isAdmin) {
                    const editBtn = actionTd.querySelector('.edit-btn');
                    if (editBtn) editBtn.onclick = () => this.openEmployeeModal(user.id);
                }
                const delBtn = actionTd.querySelector('.del-btn');
                if (delBtn) delBtn.onclick = () => this.deleteEmployee(user.id);

                row.appendChild(actionTd);
            }

            tbody.appendChild(row);
        });
    }

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

    async saveDefaultLunch(userId, dateKey, timeSlot) {
        try {
            await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateKey,
                    userId,
                    timeSlot,
                    type: 'lunch-break',
                    description: 'Lunch Break',
                    startPage: 0,
                    endPage: 0
                })
            });
        } catch (e) {
            console.error('Error saving default lunch:', e);
        }
    }



    renderEmployeeVerticalView() {
        const container = document.getElementById('employeeVerticalTimesheet');
        if (!container) return;

        const user = this.employees.find(u => u.id == this.currentUser.id);
        if (!user) {
            container.innerHTML = '<p style="text-align:center; padding:2rem;">User not found</p>';
            return;
        }

        const dateKey = this.getDateKey(this.currentDate);
        const slots = this.activities[dateKey]?.[user.id] || {};

        // Auto-fill lunch for 01:00-01:40 if not already filled (skip on Sundays)
        const currentDay = this.currentDate.getDay();
        const lunchSlot = '01:00-01:40';

        if (currentDay !== 0 && !slots[lunchSlot]) { // Skip lunch on Sunday (day 0)
            // Check if we've already saved lunch for this user today
            const lunchKey = `lunch_saved_${dateKey}_${user.id}`;
            const alreadySaved = sessionStorage.getItem(lunchKey);

            // Initialize activities structure if needed
            if (!this.activities[dateKey]) this.activities[dateKey] = {};
            if (!this.activities[dateKey][user.id]) this.activities[dateKey][user.id] = {};

            // Add default lunch activity (no type, just description)
            this.activities[dateKey][user.id][lunchSlot] = [{
                type: 'lunch-break',  // Special type for lunch
                description: 'Lunch Break',
                pagesDone: '0',
                timestamp: new Date().toISOString()
            }];

            // Save to backend only once
            if (!alreadySaved) {
                this.saveDefaultLunch(user.id, dateKey, lunchSlot);
                sessionStorage.setItem(lunchKey, 'true');
            }
        }

        // Auto-fill Sunday as Holiday for all slots
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

        // Calculate totals
        let proof = 0, epub = 0, calibr = 0;
        Object.values(slots).forEach(actList => {
            if (Array.isArray(actList)) {
                actList.forEach(act => {
                    const p = parseInt(act.pagesDone) || 0;
                    if (act.type === 'proof') proof += p;
                    if (act.type === 'epub') epub += p;
                    if (act.type === 'calibr') calibr += p;
                });
            }
        });

        // Build vertical layout HTML
        let html = `
            <div class="employee-header">
                <div class="employee-name" style="display: flex; align-items: center; justify-content: center; gap: 8px;" data-userid="${user.id}" data-username="${user.name}">
                    <span style="cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-size: 1.1rem; padding: 4px 8px; border-radius: 6px; position: relative; text-align: center;">${user.name}</span>
                </div>
                <div class="employee-stats">
                    <div class="stat-item">
                        <div class="stat-label">Proof</div>
                        <div class="stat-value">${proof || '-'}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Epub</div>
                        <div class="stat-value">${epub || '-'}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Calibr</div>
                        <div class="stat-value">${calibr || '-'}</div>
                    </div>
                </div>
            </div>
            <div class="timeslot-list">
        `;

        // Render each time slot as a row
        this.timeSlots.forEach(slot => {
            const acts = this.getActivity(user.id, slot);
            const isPast = this.isTimeSlotPast(slot);
            const isCurrent = this.isCurrentTimeSlot(slot);
            const hasActivity = acts && acts.length > 0;

            html += `
                <div class="timeslot-row ${isPast && !hasActivity ? 'past-slot' : ''} ${isCurrent ? 'current-slot' : ''}" data-slot="${slot}" data-userid="${user.id}">
                    <div class="timeslot-time">${slot}</div>
                    <div class="timeslot-activity ${hasActivity ? '' : 'empty'} ${isPast ? 'past-slot' : ''}">
            `;

            if (hasActivity) {
                html += '<div class="activity-content">';
                acts.forEach(act => {
                    html += `<div class="activity-item">`;

                    // Special handling for lunch-break - only show description
                    if (act.type === 'lunch-break') {
                        html += `<span class="activity-desc" style="background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%); padding: 8px 16px; border-radius: 8px; border: 2px solid #f97316; color: #9a3412; font-weight: 700; font-size: 1rem;">${act.description}</span>`;
                    } else if (act.type === 'sunday-holiday') {
                        // Special handling for Sunday Holiday - only show description
                        html += `<span class="activity-desc" style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 8px 16px; border-radius: 8px; border: 2px solid #10b981; color: #065f46; font-weight: 700; font-size: 1rem;">${act.description}</span>`;
                    } else {
                        // Normal activities - show badge and description
                        html += `<span class="activity-badge ${act.type}">${act.type}</span>`;
                        if (act.description) {
                            html += `<span class="activity-desc">${act.description}</span>`;
                        }
                    }

                    html += `</div>`;
                });
                html += '</div>';
            }

            html += `
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // Add click handler for employee name
        const employeeName = container.querySelector('.employee-name');
        if (employeeName) {
            const nameSpan = employeeName.querySelector('span');

            // Click handler on span only
            if (nameSpan) {
                nameSpan.addEventListener('click', () => {
                    const userId = parseInt(employeeName.dataset.userid);
                    const userName = employeeName.dataset.username;
                    this.openEmployeeActionModal(userId, userName);
                });

                // Premium hover effects - Red & Bold with Sparkle
                nameSpan.addEventListener('mouseenter', () => {
                    // Red color with bold
                    nameSpan.style.color = '#ef4444';
                    nameSpan.style.fontWeight = '700';
                    nameSpan.style.letterSpacing = '0.5px';
                    nameSpan.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)';
                    nameSpan.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.2)';
                    nameSpan.style.transform = 'translateX(2px)';

                    // Add sparkle symbol after text
                    nameSpan.setAttribute('data-hover', 'true');
                    nameSpan.innerHTML = nameSpan.textContent + ' <span style="display: inline-block; margin-left: 6px; animation: sparkle 0.6s ease-in-out infinite alternate;">✨</span>';
                });

                nameSpan.addEventListener('mouseleave', () => {
                    // Reset styles
                    nameSpan.style.color = '';
                    nameSpan.style.fontWeight = '';
                    nameSpan.style.letterSpacing = '';
                    nameSpan.style.background = '';
                    nameSpan.style.boxShadow = '';
                    nameSpan.style.transform = '';

                    // Remove sparkle
                    if (nameSpan.getAttribute('data-hover')) {
                        nameSpan.innerHTML = nameSpan.textContent.replace(' ✨', '');
                        nameSpan.removeAttribute('data-hover');
                    }
                });
            }
        }

        // Add sparkle animation to document if not already added
        if (!document.getElementById('sparkle-animation')) {
            const style = document.createElement('style');
            style.id = 'sparkle-animation';
            style.textContent = `
                @keyframes sparkle {
                    0% { transform: scale(1) rotate(0deg); opacity: 0.8; }
                    100% { transform: scale(1.2) rotate(20deg); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        // Add click handlers for each timeslot
        container.querySelectorAll('.timeslot-row').forEach(row => {
            row.addEventListener('click', () => {
                const slot = row.dataset.slot;
                const userId = parseInt(row.dataset.userid);
                this.openActivityModal(userId, slot);
            });
        });
    }

    createActivityCell(userId, timeSlot) {
        const acts = this.getActivity(userId, timeSlot); // returns Array or null
        const div = document.createElement('div');
        div.className = 'activity-cell';

        // Enforce centered and clean style (User Request)
        div.style.justifyContent = 'center';
        div.style.alignItems = 'center';
        div.style.border = 'none';
        div.style.background = 'transparent';
        div.style.boxShadow = 'none';

        // Only employees can add/edit activities (not admins)
        const isAdmin = this.currentUser.role === 'admin';
        if (!isAdmin) {
            div.onclick = () => {
                console.log('Activity cell clicked:', { userId, timeSlot, currentUserId: this.currentUser.id, role: this.currentUser.role });
                this.openActivityModal(userId, timeSlot);
            };
            div.style.cursor = 'pointer';
        } else {
            div.style.cursor = 'default';
            div.title = 'Admins cannot add activities. Only employees can.';
        }

        if (acts && acts.length > 0) {
            div.classList.add('has-activity');

            // Show ALL activities stacked
            let html = '';
            acts.forEach(act => {
                // Special handling for predefined types to match Employee View aesthetics
                if (act.type === 'sunday-holiday') {
                    html += `<div class="activity-item" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">`;
                    html += `<span style="background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); padding: 6px 12px; border-radius: 6px; border: 1px solid #94a3b8; color: #475569; font-weight: 600; font-size: 0.8em; white-space: nowrap;">${act.description}</span>`;
                    html += `</div>`;
                } else if (act.type === 'lunch-break') {
                    html += `<div class="activity-item" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">`;
                    html += `<span style="background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%); padding: 6px 12px; border-radius: 6px; border: 1px solid #f97316; color: #9a3412; font-weight: 600; font-size: 0.8em; white-space: nowrap;">${act.description}</span>`;
                    html += `</div>`;
                } else {
                    // Standard Activity Rendering - Clean Style (No Box)
                    html += `<div class="activity-item type-${act.type}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; margin-bottom: 6px; height: 100%; width: 100%;">`;
                    html += `<span class="badge" style="font-size: 0.75em; margin-bottom: 2px; display: inline-block;">${act.type}</span>`;
                    if (act.description) {
                        html += `<div class="desc" style="font-size: 0.85em; width: 100%; word-break: break-word; line-height: 1.3;">${act.description}</div>`;
                    }
                    html += `</div>`;
                }
            });
            div.innerHTML = html;
        } else {
            div.classList.add('empty');
            div.innerHTML = '<span>+</span>';

            // Admin: Click "+" to Send Reminder
            if (isAdmin) {
                div.style.cursor = 'pointer';
                div.title = 'Click to Notify Employee';
                div.onclick = (e) => {
                    e.stopPropagation();
                    this.confirmSendReminder(userId, timeSlot);
                };
            }
        }
        // Check if slot is past
        if (this.isTimeSlotPast(timeSlot)) {
            div.classList.add('past-slot');
        }

        return div;
    }

    isTimeSlotPast(timeSlot) {
        // Parse time slot "9:00-10:00" etc.
        // We assume the slot string format is known and stable.
        const [startStr, endStr] = timeSlot.split('-'); // e.g., ["9:00", "10:00"]
        if (!endStr) return false;

        const now = new Date();
        const endTime = this.parseTimeStr(endStr.trim());

        return now > endTime;
    }

    parseTimeStr(timeStr) {
        // Converts "10:00", "01:00" etc to a Date object for today.
        // Logic: 9, 10, 11 -> AM. 12 -> PM (noon). 1, 2, 3.. 8 -> PM.
        const [hourStr, minuteStr] = timeStr.split(':');
        let hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);

        // Adjust for AM/PM logic specific to this shift (9AM to 8PM)
        // If hour is between 9 and 11, it's AM (keep as is).
        // If hour is 12, it's 12 PM (keep as is).
        // If hour is 1 to 8 (inclusive), it's PM (add 12).
        if (hour >= 1 && hour <= 8) {
            hour += 12;
        }
        // Note: The logic handles 12 correctly (12 PM is 12, 12 AM would be 0).

        const date = new Date();
        date.setHours(hour, minute, 0, 0);
        return date;
    }

    updateTimeSlotStyles() {
        // Re-apply styles to all activity cells based on current time
        // This avoids full re-render
        document.querySelectorAll('.activity-cell').forEach(cell => {
            // We need to know which slot it belongs to. 
            // Since we don't store it on the element, we might need to re-render or add data attribute.
            // Let's modify creation to add data-slot.
        });
        // Actually, easiest is to just re-render if it's not expensive, OR add data attribute.
        // Let's add data-slot in createActivityCell and use it here.
        // Re-implementing createActivityCell to add data attribute first.
        // Wait, I can't easily modify createActivityCell in this block without being messy.
        // Let's just re-render the timesheet table. It's safe.
        this.renderTimesheet();
    }

    // ==========================================
    // MODAL & CRUD API METHODS (Restored)
    // ==========================================

    openEmployeeModal(userId = null) {
        // Restriction: Only Admins can EDIT. TLs can ADD.
        if (userId && this.currentUser.role !== 'admin') {
            alert('Access Denied: Only Administrators can edit employee records.');
            return;
        }

        const modal = document.getElementById('employeeModal');
        const title = document.getElementById('employeeModalTitle');
        const form = document.getElementById('employeeForm');
        const passwordField = document.getElementById('employeePassword');
        const passwordHint = document.getElementById('passwordHint');
        const toggleBtn = document.getElementById('togglePasswordBtn');

        form.reset();
        this.editingUserId = userId;

        if (userId) {
            title.textContent = 'Edit Employee';

            // Fetch user data including password
            fetch(`/api/users/${userId}/password`)
                .then(res => res.json())
                .then(user => {
                    document.getElementById('employeeName').value = user.name;
                    document.getElementById('employeeUsername').value = user.username;
                    const emailField = document.getElementById('employeeEmail');
                    if (emailField) {
                        emailField.value = user.email || '';
                        emailField.setAttribute('required', 'required'); // Ensure it stays required
                        emailField.placeholder = 'Enter email (Required for recovery)';
                    }
                    const roleSelect = document.getElementById('employeeRole');
                    if (roleSelect) roleSelect.value = user.role || 'employee';

                    const isHashed = user.password && user.password.startsWith('$2');

                    // Handle Password Field
                    if (passwordField) {
                        passwordField.removeAttribute('required');

                        // If it's a legacy hash, we can't show it. If it's plain text (new system), show it.
                        if (isHashed) {
                            passwordField.value = '';
                            passwordField.placeholder = '(Encrypted) Enter new to reset';
                        } else {
                            passwordField.value = user.password || '';
                            passwordField.placeholder = 'Enter password';
                        }

                        // Always show toggle button if there is a password (even if hashed/hidden)
                        if ((user.password) && toggleBtn) {
                            toggleBtn.style.display = 'block';
                        }
                    }

                    // Update hint message
                    if (passwordHint) {
                        const sendBtn = user.email ?
                            ` <button type="button" id="sendPasswordBtn" style="margin-left: 10px; padding: 4px 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">📧 Send Password</button>` : '';

                        let hintText = '';
                        if (isHashed) {
                            hintText = `✓ Password is set (Encrypted). Admin cannot view old encrypted passwords. Reset to view in future.${sendBtn}`;
                        } else {
                            hintText = `✓ Current password is exposed (Plain Text).${sendBtn}`;
                        }

                        passwordHint.innerHTML = hintText;
                        passwordHint.style.display = 'block';

                        // Add event listener for send password button
                        if (user.email) {
                            setTimeout(() => {
                                const sendPasswordBtn = document.getElementById('sendPasswordBtn');
                                if (sendPasswordBtn) {
                                    sendPasswordBtn.onclick = () => {
                                        if (isHashed && !confirm('Password is encrypted and cannot be seen. Send anyway? (User might accept it if they know it)')) {
                                            return;
                                        }
                                        this.sendPasswordEmail(user.id, user.email, user.name, isHashed ? 'HIDDEN (Ask Admin to Reset)' : user.password);
                                    };
                                }
                            }, 100);
                        }
                    }
                })
                .catch(err => {
                    console.error('Error fetching user password:', err);
                    this.showStatus('Error loading user data. Please try again.', 'error');
                    // Still allow editing with empty password field
                    if (passwordField) {
                        passwordField.value = '';
                        passwordField.placeholder = 'Enter password';
                    }
                });
        } else {
            title.textContent = 'Add New Employee';

            // Make password required when adding new employee
            if (passwordField) {
                passwordField.setAttribute('required', 'required');
                passwordField.placeholder = 'Enter password';
                passwordField.value = '';
                // Show password as text by default for admin convenience
                passwordField.type = 'text';
            }

            // Make Email required for new employees (for recovery)
            const emailField = document.getElementById('employeeEmail');
            if (emailField) {
                emailField.setAttribute('required', 'required');
                emailField.placeholder = 'Enter email (Required for recovery)';
            }

            // Show toggle button for new employees
            if (toggleBtn) {
                toggleBtn.style.display = 'block';
                toggleBtn.textContent = '🙈'; // Since it's showing text
                toggleBtn.title = 'Hide Password';
            }

            // Hide hint for new employees
            if (passwordHint) {
                passwordHint.style.display = 'none';
            }
        }


        // Setup show/hide password toggle
        if (toggleBtn && passwordField) {
            // Remove any existing listeners
            const newToggleBtn = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

            // Add new listener
            newToggleBtn.addEventListener('click', () => {
                if (passwordField.type === 'password') {
                    passwordField.type = 'text';
                    newToggleBtn.textContent = '🙈';
                    newToggleBtn.title = 'Hide Password';
                } else {
                    passwordField.type = 'password';
                    newToggleBtn.textContent = '👁️';
                    newToggleBtn.title = 'Show Password';
                }
            });
        }

        // Use global openModal if available, else legacy class
        if (window.openModal) window.openModal('employeeModal');
        else modal.classList.add('show');
    }

    closeEmployeeModal() {
        if (window.closeAllModals) window.closeAllModals();
        else document.getElementById('employeeModal')?.classList.remove('show');
        this.editingUserId = null;
    }

    async addEmployee(name, username, password, role, email) {
        try {
            const payload = { name, username, password, role, email };

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                this.showStatus('Employee added successfully!');
                await this.loadData();
                this.renderTimesheet();
            } else {
                const data = await res.json();
                this.showStatus(data.error || 'Failed to add', 'error');
            }
        } catch (e) {
            this.showStatus('Error adding employee', 'error');
        }
    }

    async updateEmployee(id, name, username, password, role, email) {
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, password, role, email })
            });
            if (res.ok) {
                this.showStatus('Employee updated successfully!');
                await this.loadData();
                this.renderTimesheet();
            } else {
                this.showStatus('Failed to update', 'error');
            }
        } catch (e) {
            this.showStatus('Error updating employee', 'error');
        }
    }

    async updateIndividualActivity(id, activityData) {
        try {
            const res = await fetch('/api/activities/individual', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    ...activityData
                })
            });

            if (res.ok) {
                // Log the update
                if (window.activityTracker) {
                    const employee = this.employees.find(emp => emp.id == activityData.userId || (this.editingActivityKey && emp.id == this.editingActivityKey.userId));
                    if (employee) {
                        const dateKey = this.getDateKey(this.currentDate);
                        const logSlot = `${dateKey} | ${this.editingActivityKey?.timeSlot || 'Update'}`;
                        window.activityTracker.addActivity(employee.name, activityData.type, `Updated: ${activityData.description}`, logSlot, 'updated', dateKey);
                    }
                }

                this.showStatus('Activity updated successfully!');
                // Clear editing state
                this.editingActivityIndex = null;
                this.editingActivityId = null;

                // Close modal and refresh
                this.closeActivityModal();
                await this.loadData();
                this.renderTimesheet();
            } else {
                const data = await res.json();
                this.showStatus(data.error || 'Failed to update activity', 'error');
            }
        } catch (e) {
            console.error('Error updating activity:', e);
            this.showStatus('Error updating activity', 'error');
        }
    }

    async deleteEmployee(id) {
        if (this.currentUser.role !== 'admin') {
            this.showStatus('Access Denied: Only Admins can delete employees.', 'error');
            return;
        }

        if (!confirm('Are you sure? This will delete all history for this user.')) return;
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                this.showStatus('Employee deleted');
                await this.loadData();
                this.renderTimesheet();
            } else {
                this.showStatus('Failed to delete', 'error');
            }
        } catch (e) {
            this.showStatus('Error deleting employee', 'error');
        }
    }

    async sendPasswordEmail(userId, email, name, password) {
        if (!email) {
            this.showStatus('No email address found for this employee', 'error');
            return;
        }

        if (!confirm(`Send password to ${name} at ${email}?`)) return;

        try {
            const res = await fetch('/api/send-password-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, email, name, password })
            });

            if (res.ok) {
                this.showStatus(`Password sent successfully to ${email}!`);
            } else {
                const data = await res.json();
                this.showStatus(data.error || 'Failed to send email', 'error');
            }
        } catch (e) {
            console.error('Error sending password email:', e);
            this.showStatus('Error sending email. Please try again.', 'error');
        }
    }

    async saveDefaultLunch(userId, dateKey, slot) {
        try {
            await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    dateKey,
                    timeSlot: slot,
                    type: 'lunch-break',
                    description: 'Lunch Break',
                    totalPages: 0,
                    pagesDone: 0,
                    timestamp: new Date().toISOString()
                })
            });
            // Log to Activity Tracker
            const userName = this.employees.find(u => u.id == userId)?.name || 'Unknown';
            window.activityTracker?.addActivity(
                userName,
                'lunch-break',
                'Lunch Break Auto-marked',
                `${dateKey} | ${slot}`,
                'CREATE',
                dateKey
            );
        } catch (e) { console.error('Error saving lunch:', e); }
    }

    async saveSundayHoliday(userId, dateKey, slot) {
        try {
            await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    dateKey,
                    timeSlot: slot,
                    type: 'sunday-holiday',
                    description: 'Sunday Holiday',
                    totalPages: 0,
                    pagesDone: 0,
                    timestamp: new Date().toISOString()
                })
            });

            // Log the holiday
            if (window.activityTracker) {
                const employee = this.employees.find(emp => emp.id == userId);
                if (employee) {
                    window.activityTracker.addActivity(employee.name, 'sunday-holiday', 'Sunday Holiday marked', `${dateKey} | ${slot}`, 'created', dateKey);
                }
            }
        } catch (e) { console.error('Error saving sunday:', e); }
    }

    openActivityModal(userId, timeSlot) {
        console.log('openActivityModal called:', { userId, timeSlot });

        // Permission check: Employees can only edit their own activities
        const isAdmin = this.currentUser.role === 'admin';
        if (!isAdmin && userId != this.currentUser.id) {
            alert('You can only edit your own activities.');
            return;
        }

        this.editingActivityKey = { userId, timeSlot };
        console.log('editingActivityKey set:', this.editingActivityKey);

        const modal = document.getElementById('activityModal');

        // Reset form FIRST (before setting values)
        document.getElementById('activityForm').reset();

        // THEN populate values (so they don't get cleared by reset)
        document.getElementById('activityTimeSlotDisplay').textContent = timeSlot;
        document.getElementById('activityEmployeeId').value = userId;
        document.getElementById('activityTimeSlot').value = timeSlot;


        // Load existing if any
        const acts = this.getActivity(userId, timeSlot);
        const hasActivity = acts && acts.length > 0;
        console.log('Has activity:', hasActivity, acts);

        // Show/hide Delete button based on whether activity exists
        // Render existing activities list
        this.renderExistingActivitiesList(userId, timeSlot);

        if (hasActivity) {
            const last = acts[acts.length - 1]; // Load last activity for editing
            document.getElementById('activityType').value = last.type;

            // Separate Issue from Description if present
            let desc = last.description;
            if (desc.includes(' | Issue: ')) {
                const parts = desc.split(' | Issue: ');
                desc = parts[0];
                const issue = parts[1];
                if (document.getElementById('activityIssues')) document.getElementById('activityIssues').value = issue;
            } else {
                if (document.getElementById('activityIssues')) document.getElementById('activityIssues').value = '';
            }

            // Clean description of page info if it was appended (legacy support)
            document.getElementById('activityDescription').value = desc.split(' (Pages:')[0];

            if (last.startPage && document.getElementById('startPage')) document.getElementById('startPage').value = last.startPage;
            if (last.endPage && document.getElementById('endPage')) document.getElementById('endPage').value = last.endPage;

            // Trigger calc
            const startInput = document.getElementById('startPage');
            if (startInput) startInput.dispatchEvent(new Event('input'));
        }

        if (window.openModal) window.openModal('activityModal');
        else modal.classList.add('show');

        console.log('Modal opened');
    }

    closeActivityModal() {
        if (window.closeAllModals) window.closeAllModals();
        else document.getElementById('activityModal')?.classList.remove('show');

        // Reset editing state
        this.editingActivityIndex = null;
        this.editingActivityId = null;
    }

    renderExistingActivitiesList(userId, timeSlot) {
        const acts = this.getActivity(userId, timeSlot);
        const hasActivity = acts && acts.length > 0;

        // Show/hide Delete button based on whether activity exists
        const deleteBtn = document.getElementById('deleteActivityBtn');
        if (deleteBtn) {
            if (hasActivity && acts.length === 1) {
                // Single activity - show delete button
                deleteBtn.style.display = 'inline-block';
                deleteBtn.textContent = 'Delete';
            } else if (hasActivity && acts.length > 1) {
                // Multiple activities - change button to "Clear All"
                deleteBtn.style.display = 'inline-block';
                deleteBtn.textContent = 'Clear All';
            } else {
                // No activity - hide button
                deleteBtn.style.display = 'none';
            }
        }

        const modalBody = document.querySelector('#activityModal .modal-body');
        let existingList = document.getElementById('existingActivitiesList');

        if (hasActivity && acts.length > 1) {
            // Create or update the activities list
            if (!existingList) {
                existingList = document.createElement('div');
                existingList.id = 'existingActivitiesList';
                existingList.style.cssText = 'margin-bottom: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;';
                modalBody.insertBefore(existingList, modalBody.firstChild);
            }

            let listHTML = '<h4 style="margin: 0 0 0.75rem 0; color: var(--primary-blue); font-size: 0.95rem;">Existing Activities in this slot:</h4>';
            acts.forEach((act, index) => {
                const actId = `${userId}-${timeSlot}-${index}`;
                listHTML += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: white; border-radius: 6px; margin-bottom: 0.5rem; border: 1px solid #e2e8f0;">
                        <div style="flex: 1;">
                            <span style="display: inline-block; padding: 2px 8px; background: var(--activity-${act.type}); color: white; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-right: 0.5rem;">${act.type.toUpperCase()}</span>
                            <span style="color: #475569;">${act.description || 'No description'}</span>
                            ${act.pagesDone && parseInt(act.pagesDone) > 0 ? `<span style="color: #64748b; font-size: 0.85rem; margin-left: 0.5rem;">(${act.pagesDone} pages)</span>` : ''}
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button type="button" class="btn btn-sm" onclick="window.timesheetManager.editIndividualActivity(${userId}, '${timeSlot}', ${index})" 
                                style="background: #3b82f6; color: white; padding: 4px 12px; font-size: 0.8rem;">
                                Edit
                            </button>
                            <button type="button" class="btn btn-sm" onclick="window.timesheetManager.deleteIndividualActivity(${userId}, '${timeSlot}', ${index})" 
                                style="background: #ef4444; color: white; padding: 4px 12px; font-size: 0.8rem;">
                                Delete
                            </button>
                        </div>
                    </div>
                `;
            });
            existingList.innerHTML = listHTML;
            existingList.style.display = 'block'; // Ensure visible
        } else if (existingList) {
            // Remove the list if it exists but we don't have multiple activities
            existingList.remove();
        }
    }

    async handleClearActivity() {
        console.log('=== handleClearActivity START ===');

        // Get values from form
        let userId = document.getElementById('activityEmployeeId')?.value;
        let timeSlot = document.getElementById('activityTimeSlot')?.value;

        console.log('Form values:', { userId, timeSlot });
        console.log('editingActivityKey:', this.editingActivityKey);
        console.log('currentUser:', this.currentUser);

        // Fallback to editingActivityKey if form values are empty
        if ((!userId || !timeSlot) && this.editingActivityKey) {
            console.log('Using editingActivityKey fallback');
            userId = this.editingActivityKey.userId;
            timeSlot = this.editingActivityKey.timeSlot;
        }

        // Last resort: use current user if we're an employee
        if (!userId && this.currentUser && this.currentUser.role !== 'admin') {
            console.log('Using currentUser fallback');
            userId = this.currentUser.id;
        }

        console.log('Final values:', { userId, timeSlot });

        if (!userId || !timeSlot) {
            console.error('Missing data - cannot clear');
            alert('Error: Unable to determine which activity to clear. Please close this modal and try again.');
            return;
        }

        // Check if activity exists
        const dateKey = this.getDateKey(this.currentDate);
        const hasActivity = this.activities[dateKey]?.[userId]?.[timeSlot];
        console.log('Activity exists?', hasActivity);

        if (!hasActivity) {
            alert('No activity found for this time slot.');
            return;
        }

        // Use custom confirmation modal instead of browser confirm
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const title = document.getElementById('confirmModalTitle');
            const message = document.getElementById('confirmModalMessage');
            const okBtn = document.getElementById('confirmOkBtn');
            const cancelBtn = document.getElementById('confirmCancelBtn');

            // Set modal content
            title.textContent = 'Clear Activity?';
            message.textContent = `Are you sure you want to clear all activities for ${timeSlot}? This action cannot be undone.`;
            okBtn.textContent = 'Clear';
            okBtn.className = 'btn';
            okBtn.style.cssText = 'min-width: 100px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;';

            // Show modal
            modal.classList.add('show');
            console.log('Confirmation modal shown');

            // Handle OK click
            const handleOk = async () => {
                console.log('User confirmed clear');
                modal.classList.remove('show');
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);

                try {
                    console.log('Sending DELETE request:', { dateKey, userId, timeSlot });

                    const res = await fetch('/api/activities', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dateKey, userId: parseInt(userId), timeSlot })
                    });

                    console.log('DELETE response status:', res.status);

                    if (res.ok) {
                        const result = await res.json();
                        console.log('DELETE success:', result);

                        // Remove locally
                        if (this.activities[dateKey]?.[userId]?.[timeSlot]) {
                            delete this.activities[dateKey][userId][timeSlot];
                            console.log('Removed from local cache');
                        }
                        // Log the clear action
                        if (window.activityTracker) {
                            const employee = this.employees.find(emp => emp.id == userId);
                            if (employee) {
                                const logSlot = `${dateKey} | ${timeSlot}`;
                                window.activityTracker.addActivity(employee.name, 'clear', `Cleared all activities for ${timeSlot}`, logSlot, 'deleted', dateKey);
                            }
                        }

                        this.closeActivityModal();
                        this.renderTimesheet();
                        this.showStatus('Activity cleared successfully');
                        resolve(true);
                    } else {
                        const errData = await res.json();
                        console.error('Delete failed:', errData);
                        alert('Failed to clear activity: ' + (errData.error || 'Unknown error'));
                        resolve(false);
                    }
                } catch (e) {
                    console.error('Clear activity error:', e);
                    alert('Error clearing activity: ' + e.message);
                    resolve(false);
                }
            };

            // Handle Cancel click
            const handleCancel = () => {
                console.log('User cancelled clear');
                modal.classList.remove('show');
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
                resolve(false);
            };

            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
        });
    }

    async deleteIndividualActivity(userId, timeSlot, activityIndex) {
        const dateKey = this.getDateKey(this.currentDate);
        console.log('🗑️  deleteIndividualActivity called:', { dateKey, userId, timeSlot, activityIndex });

        // Get the activities for this slot
        const acts = this.getActivity(userId, timeSlot);
        if (!acts || activityIndex >= acts.length) {
            this.showStatus('Activity not found', 'error');
            return;
        }

        const activityToDelete = acts[activityIndex];

        // Confirm deletion
        if (!confirm(`Delete ${activityToDelete.type} activity: "${activityToDelete.description}"?`)) {
            return;
        }

        try {
            // Delete from backend by sending the specific activity details
            const res = await fetch('/api/activities/individual', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateKey,
                    userId: parseInt(userId),
                    timeSlot,
                    activityIndex: activityIndex
                })
            });

            console.log('DELETE response status:', res.status);
            const responseData = await res.json();
            console.log('DELETE response data:', responseData);

            if (res.ok) {
                // Remove from local cache
                if (this.activities[dateKey]?.[userId]?.[timeSlot]) {
                    this.activities[dateKey][userId][timeSlot].splice(activityIndex, 1);

                    // If no activities left, remove the slot entirely
                    if (this.activities[dateKey][userId][timeSlot].length === 0) {
                        delete this.activities[dateKey][userId][timeSlot];
                    }

                    console.log('✅ Removed from local cache');
                }

                // Reload the data and re-render
                await this.loadData();
                this.renderTimesheet();

                // Reopen the modal to show updated list
                this.openActivityModal(userId, timeSlot);

                // Log the individual deletion
                if (window.activityTracker) {
                    const employee = this.employees.find(emp => emp.id == userId);
                    if (employee) {
                        const logSlot = `${dateKey} | ${timeSlot}`;
                        window.activityTracker.addActivity(employee.name, activityToDelete.type, `Deleted individual activity: ${activityToDelete.description}`, logSlot, 'deleted', dateKey);
                    }
                }

                this.showStatus('Activity deleted successfully');
            } else {
                console.error('❌ Delete failed:', responseData);
                this.showStatus(responseData.error || 'Failed to delete activity', 'error');
            }
        } catch (e) {
            console.error('❌ Error deleting activity:', e);
            this.showStatus('Error deleting activity', 'error');
        }
    }

    editIndividualActivity(userId, timeSlot, activityIndex) {
        console.log('✏️  editIndividualActivity called:', { userId, timeSlot, activityIndex });

        // Get the activities for this slot
        const acts = this.getActivity(userId, timeSlot);
        if (!acts || activityIndex >= acts.length) {
            this.showStatus('Activity not found', 'error');
            return;
        }

        const activityToEdit = acts[activityIndex];

        // Store the editing index AND ID so we know which activity to update
        this.editingActivityIndex = activityIndex;
        this.editingActivityId = activityToEdit.id;
        console.log('Editing Activity:', { index: activityIndex, id: this.editingActivityId });

        // Hide the activities list temporarily
        const existingList = document.getElementById('existingActivitiesList');
        if (existingList) {
            existingList.style.display = 'none';
        }

        // Load the activity data into the form
        document.getElementById('activityType').value = activityToEdit.type;

        // Separate Issue from Description if present
        let desc = activityToEdit.description;
        if (desc.includes(' | Issue: ')) {
            const parts = desc.split(' | Issue: ');
            desc = parts[0];
            const issue = parts[1];
            if (document.getElementById('activityIssues')) {
                document.getElementById('activityIssues').value = issue;
            }
        } else {
            if (document.getElementById('activityIssues')) {
                document.getElementById('activityIssues').value = '';
            }
        }

        // Clean description of page info if it was appended (legacy support)
        document.getElementById('activityDescription').value = desc.split(' (Pages:')[0];

        // Load page numbers
        if (activityToEdit.startPage && document.getElementById('startPage')) {
            document.getElementById('startPage').value = activityToEdit.startPage;
        }
        if (activityToEdit.endPage && document.getElementById('endPage')) {
            document.getElementById('endPage').value = activityToEdit.endPage;
        }

        // Trigger page calculation
        const startInput = document.getElementById('startPage');
        if (startInput) startInput.dispatchEvent(new Event('input'));

        // Change the save button text to indicate editing
        const saveBtn = document.querySelector('#activityForm button[type="submit"]');
        if (saveBtn) {
            saveBtn.textContent = 'Update Activity';
            saveBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        }

        // Add a cancel edit button
        let cancelEditBtn = document.getElementById('cancelEditBtn');
        if (!cancelEditBtn) {
            cancelEditBtn = document.createElement('button');
            cancelEditBtn.id = 'cancelEditBtn';
            cancelEditBtn.type = 'button';
            cancelEditBtn.className = 'btn btn-secondary';
            cancelEditBtn.textContent = 'Cancel Edit';
            cancelEditBtn.style.cssText = 'margin-right: 0.5rem;';

            const formActions = document.querySelector('#activityForm .form-actions');
            const cancelBtn = document.getElementById('cancelActivityBtn');
            if (formActions && cancelBtn) {
                formActions.insertBefore(cancelEditBtn, cancelBtn.nextSibling);
            }
        }

        cancelEditBtn.style.display = 'inline-block';
        cancelEditBtn.onclick = () => {
            cancelEditBtn.onclick = () => {
                this.editingActivityIndex = null;
                this.editingActivityId = null;
                this.openActivityModal(userId, timeSlot);
            };
            this.openActivityModal(userId, timeSlot);
        };

        this.showStatus(`Editing activity ${activityIndex + 1}. Click "Update Activity" to save changes.`, 'info');
    }

    async clearActivity(userId, timeSlot) {
        const dateKey = this.getDateKey(this.currentDate);
        console.log('🗑️  clearActivity called:', { dateKey, userId, timeSlot });

        try {
            const requestBody = {
                dateKey,
                userId: parseInt(userId),
                timeSlot
            };

            const res = await fetch('/api/activities', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (res.ok) {
                // Log the clear action
                if (window.activityTracker) {
                    const employee = this.employees.find(emp => emp.id == userId);
                    if (employee) {
                        const logSlot = `${dateKey} | ${timeSlot}`;
                        window.activityTracker.addActivity(employee.name, 'clear', 'Cleared all activities for slot', logSlot, 'deleted', dateKey);
                    }
                }

                // Remove locally
                if (this.activities[dateKey]?.[userId]?.[timeSlot]) {
                    delete this.activities[dateKey][userId][timeSlot];
                }
                this.closeActivityModal();
                this.renderTimesheet();
                this.showStatus('Activity deleted successfully');
            } else {
                const responseData = await res.json();
                this.showStatus(responseData.error || 'Failed to delete activity', 'error');
            }
        } catch (e) {
            console.error('❌ Error deleting activity:', e);
            this.showStatus('Error deleting activity', 'error');
        }
    }

    openEmployeeActionModal(userId, name) {
        document.getElementById('actionEmployeeName').textContent = name;
        this.actionUserId = userId; // Store for action
        if (window.openModal) window.openModal('employeeActionModal');
    }

    closeEmployeeActionModal() {
        if (window.closeAllModals) window.closeAllModals();
        this.actionUserId = null;
    }

    showTimeSelectionForm(type) {
        this.currentActionType = type;
        const optionsDiv = document.getElementById('actionButtons');
        if (optionsDiv) optionsDiv.style.display = 'none';

        const formDiv = document.getElementById('timeSelectionForm');
        formDiv.style.display = 'block';

        // Update title based on type
        const titleText = type === 'leave' ? 'Mark Leave' : type === 'permission' ? 'Mark Permission' : 'Add Holiday';
        document.getElementById('timeSelectionTitle').textContent = titleText;

        // Populate slots
        const startSelect = document.getElementById('startSlot');
        const endSelect = document.getElementById('endSlot');

        if (startSelect && startSelect.options.length === 0) {
            this.timeSlots.forEach(slot => {
                startSelect.add(new Option(slot, slot));
                endSelect.add(new Option(slot, slot));
            });
        }

        // Reset check and selects
        const check = document.getElementById('fullDayCheck');
        if (check) check.checked = false;
        if (startSelect) startSelect.disabled = false;
        if (endSelect) endSelect.disabled = false;
    }

    hideTimeSelectionForm() {
        // Use ID 'actionButtons' which is consistent with HTML
        const optionsDiv = document.getElementById('actionButtons');
        if (optionsDiv) optionsDiv.style.display = 'flex';
        document.getElementById('timeSelectionForm').style.display = 'none';
    }

    async handleLeavePermissionSubmit() {
        const fullDayCheck = document.getElementById('fullDayCheck');
        const isFullDay = fullDayCheck ? fullDayCheck.checked : false;

        const start = document.getElementById('startSlot').value;
        const end = document.getElementById('endSlot').value;
        const reason = document.getElementById('permissionReason').value || 'No Reason';
        const dateKey = this.getDateKey(this.currentDate);

        // Validate
        if (!isFullDay && (!start || !end)) {
            this.showStatus('Please select time range', 'error');
            return;
        }

        try {
            if (this.currentActionType === 'leave') {
                const res = await fetch('/api/leave', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: this.actionUserId,
                        startDate: dateKey,
                        endDate: dateKey,
                        reason: isFullDay ? `Full Day: ${reason}` : `${reason} (${start} - ${end})`,
                        isFullDay
                    })
                });

                if (res.ok) {
                    this.showStatus('Leave request submitted properly');

                    if (isFullDay) {
                        for (const slot of this.timeSlots) {
                            await this.setActivity(this.actionUserId, slot, {
                                type: 'leave',
                                description: `FULL_DAY_LEAVE: ${reason}`,
                                pagesDone: '0',
                                timestamp: new Date().toISOString()
                            });
                        }
                    } else {
                        const sIdx = this.timeSlots.indexOf(start);
                        const eIdx = this.timeSlots.indexOf(end);

                        if (sIdx > -1 && eIdx > -1) {
                            const rangeSlots = this.timeSlots.slice(Math.min(sIdx, eIdx), Math.max(sIdx, eIdx) + 1);
                            for (const slot of rangeSlots) {
                                await this.setActivity(this.actionUserId, slot, {
                                    type: 'leave',
                                    description: `Partial Leave: ${reason}`,
                                    pagesDone: '0',
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    }
                }
            } else if (this.currentActionType === 'permission') {
                const res = await fetch('/api/permission', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: this.actionUserId,
                        dateKey,
                        startTime: start,
                        endTime: end,
                        reason
                    })
                });

                if (res.ok) {
                    this.showStatus('Permission logged');
                    // Mark slots for permission visually
                    const sIdx = this.timeSlots.indexOf(start);
                    const eIdx = this.timeSlots.indexOf(end);
                    if (sIdx > -1 && eIdx > -1) {
                        const rangeSlots = this.timeSlots.slice(Math.min(sIdx, eIdx), Math.max(sIdx, eIdx) + 1);
                        for (const slot of rangeSlots) {
                            await this.setActivity(this.actionUserId, slot, {
                                type: 'permission',
                                description: `Permission: ${reason}`,
                                pagesDone: '0',
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }
            } else if (this.currentActionType === 'holiday') {
                // Handle holiday marking
                this.showStatus('Holiday marked');

                if (isFullDay) {
                    // Mark all slots as holiday
                    for (const slot of this.timeSlots) {
                        await this.setActivity(this.actionUserId, slot, {
                            type: 'Holiday',
                            description: 'Full Day Holiday',
                            pagesDone: '0',
                            timestamp: new Date().toISOString()
                        });
                    }
                } else {
                    // Mark partial day holiday
                    const sIdx = this.timeSlots.indexOf(start);
                    const eIdx = this.timeSlots.indexOf(end);

                    if (sIdx > -1 && eIdx > -1) {
                        const rangeSlots = this.timeSlots.slice(Math.min(sIdx, eIdx), Math.max(sIdx, eIdx) + 1);
                        for (const slot of rangeSlots) {
                            await this.setActivity(this.actionUserId, slot, {
                                type: 'Holiday',
                                description: `Partial Holiday (${start} - ${end})`,
                                pagesDone: '0',
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }
            }
            this.closeEmployeeActionModal();
            this.renderTimesheet();
        } catch (e) {
            console.error(e);
            this.showStatus('Error submitting request', 'error');
        }
    }




    // Reminders
    // Reminders
    playReminderSound() {
        // Simple 'ding' sound (Base64 MP3) - Short pleasant chime
        const audioSrc = 'data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//tgxAAAAAA';
        // (Truncated for brevity in prompt, I will use a real short base64 in the actual file write, checking length)
        // Actually, for robustness, let's use a standard beep function or a hosted valid base64. 
        // I will use a minimal valid MP3 base64 here.
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Notification chime
        audio.volume = 0.5;
        audio.play().catch(e => console.warn('Audio play prevented:', e));
    }

    startHourlyReminder() {
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }

        // Check every minute
        setInterval(() => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMin = now.getMinutes();

            // Logic: Determine which slot just passed or is current
            // Our slots: 9-10, 10-11, 11-11:10, 11:10-12, 12-1, 1-1:40, 1:40-3, 3-3:50, 3:50-4, 4-5, 5-6, 6-7, 7-8
            // We want to alert if a slot END TIME has passed recently (e.g. within last 5 mins) and it's empty.
            // Or simple hourly check: "It's 10:05, did you fill 9-10?"

            // Helper to parsing slot string "HH:MM-HH:MM"
            // Let's implement specific checks for our known schedule to be precise

            let slotToCheck = null;

            // Simple map of "Check Time (Hour:Minute)" -> "Slot to Check"
            // We check 5 minutes after the hour/slot ends
            const checkMap = {
                '10:05': '9:00-10:00',
                '11:05': '10:00-11:00',
                '11:15': '11:00-11:10',
                '12:05': '11:10-12:00',
                '13:05': '12:00-01:00', // 1:05 PM
                '13:45': '01:00-01:40', // 1:45 PM checks 1:00-1:40
                '15:05': '01:40-03:00', // 3:05 PM
                '15:55': '03:00-03:50', // 3:55 PM
                '16:05': '03:50-04:00', // 4:05 PM
                '17:05': '04:00-05:00',
                '18:05': '05:00-06:00'
            };

            const timeKey = `${currentHour}:${currentMin.toString().padStart(2, '0')}`;
            slotToCheck = checkMap[timeKey];

            if (slotToCheck) {
                // Check if filled
                const acts = this.getActivity(this.currentUser.id, slotToCheck);
                if (!acts || acts.length === 0) {
                    // Not filled!
                    if (Notification.permission === "granted") {
                        new Notification("Timesheet Reminder 🔔", {
                            body: `Missing entry for ${slotToCheck}. Please fill your timesheet!`,
                            icon: 'images/logogo.jpg'
                        });
                        this.playReminderSound();
                    }
                }
            }

        }, 60000); // Run every minute
    }

    // Clock & Greetings
    updateClock() {
        const clock = document.getElementById('digitalClock');
        if (clock) {
            const now = new Date();
            // Indian Standard Time (IST) explicitly or Browser Local? User asked "Indian digital clock".
            // Browser local in India is IST. To be safe, we can use 'en-IN'.
            const timeStr = now.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).toUpperCase();
            clock.textContent = timeStr;
        }
    }

    showGreeting() {
        if (sessionStorage.getItem('greeted')) return;

        const hour = new Date().getHours();
        let greeting = 'Good Morning';
        let icon = '☀️';

        if (hour >= 12 && hour < 17) {
            greeting = 'Good Afternoon';
            icon = '🌤️';
        } else if (hour >= 17) {
            greeting = 'Good Evening';
            icon = '🌙';
        }

        const msg = `${greeting}, Have a Nice Day!`;

        const toast = document.createElement('div');
        toast.className = 'greeting-toast';
        toast.innerHTML = `<span class="greeting-icon">${icon}</span><span class="greeting-text">${msg}</span>`;
        document.body.appendChild(toast);

        sessionStorage.setItem('greeted', 'true');

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    // ==========================================
    // FORM SUBMISSION HANDLERS
    // ==========================================

    async handleEmployeeSubmit(e) {
        e.preventDefault();

        // BLOCK Admin2 (Supervisor) from managing users
        if (this.currentUser.username === 'admin2') {
            this.showStatus('Access Denied: Supervisors cannot manage employees.', 'error');
            return;
        }

        const name = document.getElementById('employeeName').value.trim();
        const username = document.getElementById('employeeUsername').value.trim();
        const password = document.getElementById('employeePassword').value.trim();
        const role = document.getElementById('employeeRole').value;

        if (!name || !username || !password) {
            this.showStatus('Please fill in all required fields', 'error');
            return;
        }

        if (this.editingUserId) {
            // Update existing employee
            await this.updateEmployee(this.editingUserId, name, username, password, role);
        } else {
            // Add new employee
            await this.addEmployee(name, username, password, role);
        }

        this.closeEmployeeModal();
    }

    async handleActivitySubmit(e, keepOpen = false) {
        e.preventDefault();

        const userId = parseInt(document.getElementById('activityEmployeeId').value);
        const timeSlot = document.getElementById('activityTimeSlot').value;
        const type = document.getElementById('activityType').value;
        const description = document.getElementById('activityDescription').value.trim();
        const issues = document.getElementById('activityIssues')?.value.trim() || '';
        const startPage = document.getElementById('startPage')?.value;
        const endPage = document.getElementById('endPage')?.value;
        const calculatedTotal = document.getElementById('calculatedTotal')?.value || '0';

        if (!type) {
            this.showStatus('Please select an activity type', 'error');
            return;
        }

        // Build final description
        let finalDescription = description;
        if (issues) {
            finalDescription += ` | Issue: ${issues}`;
        }

        // Build activity data
        const activityData = {
            type: type,
            description: finalDescription,
            pagesDone: calculatedTotal,
            totalPages: calculatedTotal,
            startPage: startPage || '',
            endPage: endPage || '',
            timestamp: new Date().toISOString()
        };

        // Check if we are UPDATING an existing activity
        if (this.editingActivityId) {
            console.log('Updating activity with ID:', this.editingActivityId);
            await this.updateIndividualActivity(this.editingActivityId, activityData);
            return; // updateIndividualActivity handles closing/reloading
        }

        // Save NEW activity
        await this.setActivity(userId, timeSlot, activityData);

        this.showStatus('Activity saved successfully');

        if (!keepOpen) {
            this.closeActivityModal();
        } else {
            // Reset form for next entry but keep the same slot
            document.getElementById('activityType').value = '';
            document.getElementById('activityDescription').value = '';
            if (document.getElementById('activityIssues')) {
                document.getElementById('activityIssues').value = '';
            }
            if (document.getElementById('startPage')) {
                document.getElementById('startPage').value = '';
            }
            if (document.getElementById('endPage')) {
                document.getElementById('endPage').value = '';
            }
            if (document.getElementById('calculatedTotal')) {
                document.getElementById('calculatedTotal').value = '0';
            }
        }

        this.renderTimesheet();
    }

    // ==========================================
    // ADMIN PANEL TOGGLE - REMOVED (UNIFIED VIEW)
    // ==========================================

    setupEventListeners() {
        // Clock Init
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        // Greeting
        this.showGreeting();

        // Activity Type Change Listener
        document.getElementById('activityType')?.addEventListener('change', (e) => {
            const type = e.target.value;
            const pageGroup = document.getElementById('pageRangeGroup');
            const descGroup = document.getElementById('activityDescription').parentElement;

            const noDetailsNeeded = ['meeting', 'break', 'lunch'].includes(type);

            if (pageGroup) pageGroup.style.display = noDetailsNeeded ? 'none' : 'block';
            if (descGroup) descGroup.style.display = noDetailsNeeded ? 'block' : 'block';
        });

        const fullDayCheck = document.getElementById('fullDayCheck');
        fullDayCheck?.addEventListener('change', (e) => {
            const isFull = e.target.checked;
            document.getElementById('startSlot').disabled = isFull;
            document.getElementById('endSlot').disabled = isFull;
        });

        // Modal Close Buttons
        document.querySelectorAll('.close-modal, .cancel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeEmployeeModal();
                this.closeActivityModal();
                this.closeEmployeeActionModal();
            });
        });

        // Header Buttons
        document.getElementById('addEmployeeBtn')?.addEventListener('click', () => {
            const role = this.currentUser.role;
            if (role !== 'admin') {
                alert('Access Denied: Admin privileges required.');
                return;
            }
            this.openEmployeeModal();
        });



        document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
            this.generateDailyReport();
        });

        // Check Missing Timesheets (Admin Only)
        document.getElementById('checkMissingBtn')?.addEventListener('click', () => {
            this.showMissingTimesheets();
        });

        // Specific Cancel Buttons (if class selection misses them)
        document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeEmployeeModal());
        document.getElementById('cancelActivityBtn')?.addEventListener('click', () => this.closeActivityModal());

        // Delete Activity Button - Robust
        document.getElementById('deleteActivityBtn')?.addEventListener('click', async (e) => {
            if (e) e.preventDefault(); // Prevent form submission if inside form
            console.log('🗑️  Delete button clicked');

            // 1. Identify User and Slot
            // If editing key exists (from clicking a colored cell), use it.
            // If not, try to infer from modal state (hidden inputs).

            let userId = this.editingActivityKey?.userId;
            let timeSlot = this.editingActivityKey?.timeSlot;

            // Fallback to hidden inputs if visual key is missing
            if (!userId) {
                const userIdInput = document.getElementById('activityEmployeeId');
                userId = userIdInput?.value;
                console.log('Using userId from input:', userId, userIdInput);
            }
            if (!timeSlot) {
                const timeSlotInput = document.getElementById('activityTimeSlot');
                timeSlot = timeSlotInput?.value;
                console.log('Using timeSlot from input:', timeSlot, timeSlotInput);
            }

            console.log('Delete Attempt:', {
                userId,
                timeSlot,
                key: this.editingActivityKey,
                dateKey: this.getDateKey(this.currentDate)
            });

            if (!userId || !timeSlot) {
                console.error('❌ Missing userId or timeSlot:', { userId, timeSlot });
                this.showStatus('Error: Select an activity to delete', 'error');
                return;
            }

            // Use Custom Confirm Modal
            const confirmModal = document.getElementById('confirmModal');
            const title = document.getElementById('confirmModalTitle');
            const msg = document.getElementById('confirmModalMessage');
            const okBtn = document.getElementById('confirmOkBtn');
            const cancelBtn = document.getElementById('confirmCancelBtn');

            if (confirmModal && title && msg && okBtn) {
                title.textContent = 'Delete Activity?';
                msg.textContent = `Are you sure you want to delete all activities for ${timeSlot}?`;

                // Show confirmation modal WITHOUT closing activity modal
                confirmModal.style.display = 'flex';
                confirmModal.style.zIndex = '10001'; // Higher than activity modal

                // Clean old listeners to prevent stacking
                const newOk = okBtn.cloneNode(true);
                okBtn.parentNode.replaceChild(newOk, okBtn);

                const newCancel = cancelBtn.cloneNode(true);
                cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

                newCancel.addEventListener('click', () => {
                    console.log('Delete cancelled');
                    confirmModal.style.display = 'none';
                });

                newOk.addEventListener('click', async () => {
                    console.log('Delete confirmed, calling clearActivity...');
                    confirmModal.style.display = 'none';
                    await this.clearActivity(userId, timeSlot);
                });
            } else {
                console.log('Confirm modal not found, using browser confirm');
                if (confirm(`Delete all activities for ${timeSlot}?`)) {
                    console.log('Delete confirmed (browser), calling clearActivity...');
                    await this.clearActivity(userId, timeSlot);
                    this.closeActivityModal();
                }
            }
        });

        // Forms
        document.getElementById('employeeForm')?.addEventListener('submit', (e) => this.handleEmployeeSubmit(e));
        document.getElementById('activityForm')?.addEventListener('submit', (e) => this.handleActivitySubmit(e));

        // Admin Panel Toggle
        document.getElementById('adminPanelToggleBtn')?.addEventListener('click', () => {
            this.toggleAdminPanel(true);
        });

        document.getElementById('backToTimesheetBtn')?.addEventListener('click', () => {
            this.toggleAdminPanel(false);
        });

        // Logout Button handled in auth-check.js (No duplicate listener needed here)

        // Page calculation
        const startPageInput = document.getElementById('startPage');
        const endPageInput = document.getElementById('endPage');
        const totalInput = document.getElementById('calculatedTotal');

        const calculateTotal = () => {
            const start = parseInt(startPageInput?.value) || 0;
            const end = parseInt(endPageInput?.value) || 0;
            if (start > 0 && end >= start) {
                const total = end - start + 1;
                if (totalInput) totalInput.value = total;
            } else {
                if (totalInput) totalInput.value = 0;
            }
        };

        startPageInput?.addEventListener('input', calculateTotal);
        endPageInput?.addEventListener('input', calculateTotal);

        // Add Another button
        document.getElementById('addAnotherBtn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.handleActivitySubmit(e, true); // Pass true to keep modal open
        });

        // Employee Action Modal Buttons (Leave/Permission)
        document.getElementById('markLeaveOptionBtn')?.addEventListener('click', () => this.showTimeSelectionForm('leave'));
        document.getElementById('markPermissionOptionBtn')?.addEventListener('click', () => this.showTimeSelectionForm('permission'));
        document.getElementById('addHolidayOptionBtn')?.addEventListener('click', () => this.showTimeSelectionForm('holiday'));
        document.getElementById('backToActionsBtn')?.addEventListener('click', () => this.hideTimeSelectionForm());
        document.getElementById('confirmActionBtn')?.addEventListener('click', () => this.handleLeavePermissionSubmit());

        // Navigation
        document.getElementById('prevDay')?.addEventListener('click', () => {
            this.currentDate.setDate(this.currentDate.getDate() - 1);
            this.setDateInput();
            this.loadData().then(() => {
                this.renderTimesheet();
                window.activityTracker?.loadLogs(this.getDateKey(this.currentDate));
            });
        });

        document.getElementById('todayBtn')?.addEventListener('click', () => {
            this.currentDate = new Date();
            this.setDateInput();
            this.loadData().then(() => {
                this.renderTimesheet();
                window.activityTracker?.loadLogs(this.getDateKey(this.currentDate));
            });
        });

        document.getElementById('nextDay')?.addEventListener('click', () => {
            this.currentDate.setDate(this.currentDate.getDate() + 1);
            this.setDateInput();
            this.loadData().then(() => {
                this.renderTimesheet();
                window.activityTracker?.loadLogs(this.getDateKey(this.currentDate));
            });
        });
    }

    // Check and display pending reminders for the current user
    async checkPendingReminders() {
        if (!this.currentUser.id) return;

        try {
            const res = await fetch(`/api/reminders?userId=${this.currentUser.id}&status=sent`);
            if (!res.ok) return;

            const reminders = await res.json();
            if (reminders.length > 0) {
                // Show reminder notification
                reminders.forEach(reminder => {
                    this.showReminderAlert(reminder);
                });
            }
        } catch (e) {
            console.log('Could not check reminders:', e);
        }
    }

    showReminderAlert(reminder) {
        // 1. Play Soft Beep (In-App Audio)
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.05, ctx.currentTime); // Low volume
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) { console.log('Audio play failed', e); }

        // 2. Native Browser Notification (OS Level)
        if ("Notification" in window) {
            if (Notification.permission === "granted") {
                new Notification("Timesheet Reminder", {
                    body: reminder.message,
                    icon: 'https://cdn-icons-png.flaticon.com/512/3602/3602145.png' // Alarm clock icon
                });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        new Notification("Timesheet Reminder", {
                            body: reminder.message,
                            icon: 'https://cdn-icons-png.flaticon.com/512/3602/3602145.png'
                        });
                    }
                });
            }
        }

        // 3. In-App Toast Notification
        const toast = document.createElement('div');
        toast.className = 'reminder-toast';
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(255, 107, 107, 0.3);
            z-index: 10001;
            max-width: 350px;
            animation: slideIn 0.4s ease-out;
            cursor: pointer;
        `;
        toast.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 1.5rem;">🔔</span>
                <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">Timesheet Reminder</div>
                    <div style="font-size: 0.9rem; opacity: 0.95;">${reminder.message}</div>
                    <div style="font-size: 0.75rem; margin-top: 8px; opacity: 0.8;">Click to dismiss</div>
                </div>
            </div>
        `;

        toast.onclick = async () => {
            // Mark as read
            try {
                await fetch(`/api/reminders/${reminder.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'read' })
                });
            } catch (e) { console.log(e); }
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        };

        document.body.appendChild(toast);

        // Auto dismiss after 15 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }
        }, 15000);
    }

    async confirmSendReminder(userId, timeSlot) {
        if (!confirm(`Notify employee to fill timesheet for ${timeSlot}?`)) return;

        try {
            const dateKey = this.getDateKey(this.currentDate);
            const res = await fetch('/api/send-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userIds: [userId],
                    dateKey: dateKey,
                    message: `Please fill your timesheet for ${timeSlot}.`
                })
            });

            if (res.ok) {
                this.showStatus('Notification sent to employee');
            } else {
                this.showStatus('Failed to send notification', 'error');
            }
        } catch (e) {
            console.error(e);
            this.showStatus('Error sending notification', 'error');
        }
    }

    // Admin: Show employees with missing timesheets
    async showMissingTimesheets() {
        if (this.currentUser.role !== 'admin') {
            this.showStatus('Admin access required', 'error');
            return;
        }

        const dateKey = this.getDateKey(this.currentDate);

        try {
            const res = await fetch(`/api/missing-timesheet?dateKey=${dateKey}`);
            if (!res.ok) throw new Error('Failed to fetch');

            const data = await res.json();

            // Create and show modal
            const modalHtml = `
                <div id="missingTimesheetModal" class="modal-backdrop" style="display: flex;">
                    <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow: auto;">
                        <div class="modal-header">
                            <h3>Missing Timesheets - ${dateKey}</h3>
                            <button class="modal-close" onclick="document.getElementById('missingTimesheetModal').remove()">×</button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom: 1rem; color: var(--neutral-600);">
                                ${data.employeesWithMissing} of ${data.totalEmployees} employees have missing entries
                            </p>
                            ${data.employees.length === 0 ?
                    '<p style="color: green; font-weight: 600;">✓ All employees have completed their timesheets!</p>' :
                    `<div style="max-height: 400px; overflow-y: auto;">
                                    ${data.employees.map(emp => `
                                        <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                <div style="font-weight: 600;">${emp.name}</div>
                                                <div style="font-size: 0.85rem; color: var(--neutral-500);">
                                                    Missing: ${emp.missingCount} slots | Filled: ${emp.filledCount} slots
                                                </div>
                                            </div>
                                            <button class="btn btn-sm btn-warning" onclick="window.timesheetManager.sendReminderTo(${emp.id}, '${emp.name}', '${dateKey}')">
                                                Send Reminder
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                                <button class="btn btn-primary" style="margin-top: 1rem; width: 100%;" 
                                    onclick="window.timesheetManager.sendReminderToAll('${dateKey}')">
                                    🔔 Send Reminder to All (${data.employeesWithMissing})
                                </button>`
                }
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch (e) {
            console.error(e);
            this.showStatus('Error checking missing timesheets', 'error');
        }
    }

    // Send reminder to a specific employee
    async sendReminderTo(userId, name, dateKey) {
        try {
            const res = await fetch('/api/send-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userIds: [userId],
                    dateKey: dateKey,
                    sentBy: this.currentUser.name
                })
            });

            if (res.ok) {
                this.showStatus(`Reminder sent to ${name}!`);
            } else {
                throw new Error('Failed');
            }
        } catch (e) {
            this.showStatus('Failed to send reminder', 'error');
        }
    }

    // Send reminder to all employees with missing timesheets
    async sendReminderToAll(dateKey) {
        try {
            const res = await fetch(`/api/missing-timesheet?dateKey=${dateKey}`);
            const data = await res.json();

            if (data.employees.length === 0) {
                this.showStatus('No employees need reminders!');
                return;
            }

            const userIds = data.employees.map(e => e.id);

            const sendRes = await fetch('/api/send-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userIds: userIds,
                    dateKey: dateKey,
                    sentBy: this.currentUser.name
                })
            });

            if (sendRes.ok) {
                const result = await sendRes.json();
                this.showStatus(`Reminders sent to ${result.remindersCount} employees!`);
                document.getElementById('missingTimesheetModal')?.remove();
            } else {
                throw new Error('Failed');
            }
        } catch (e) {
            console.error(e);
            this.showStatus('Failed to send reminders', 'error');
        }
    }

    generateDailyReport() {
        const dateKey = this.getDateKey(this.currentDate);
        const dateStr = this.currentDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // Filter users: if employee, only show self. If admin, show all but self/other admins.
        let users = [];
        if (this.currentUser.role === 'admin') {
            users = this.employees.filter(u => u.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name));
        } else {
            users = this.employees.filter(u => u.id === this.currentUser.id);
        }

        // Open Report Window
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to generate the report.');
            return;
        }

        // Generate Grid Headers
        let tableHeaderCols = `
            <th rowspan="2" style="width: 150px;">Employee Name</th>
            <th colspan="3" style="text-align: center; width: 120px;">Total Pages</th>
        `;

        this.timeSlots.forEach(slot => {
            tableHeaderCols += `<th rowspan="2" style="font-size: 10px; width: 80px; text-align: center;">${slot}</th>`;
        });

        const secondHeaderRow = `
            <tr>
                <th style="font-size: 10px; width: 40px; text-align: center;">Proof</th>
                <th style="font-size: 10px; width: 40px; text-align: center;">Epub</th>
                <th style="font-size: 10px; width: 40px; text-align: center;">Calibr</th>
            </tr>
        `;

        // Generate Rows
        const tableRows = users.map(user => {
            const userSlots = this.activities[dateKey]?.[user.id] || {};

            // Calculate Totals
            let proof = 0, epub = 0, calibr = 0;
            // Iterate all slots to sum
            const firstSlotActs = userSlots[this.timeSlots[0]];
            const isLeave = (firstSlotActs && firstSlotActs.length > 0 && firstSlotActs[0].type === 'leave' && firstSlotActs[0].description === 'FULL_DAY_LEAVE');

            if (!isLeave) {
                Object.values(userSlots).forEach(actList => {
                    if (Array.isArray(actList)) {
                        actList.forEach(act => {
                            const p = parseInt(act.pagesDone) || 0;
                            if (act.type === 'proof') proof += p;
                            if (act.type === 'epub') epub += p;
                            if (act.type === 'calibr') calibr += p;
                        });
                    }
                });
            }

            let rowHtml = `<tr>`;
            rowHtml += `<td style="font-weight: 600; color: #1e3a8a; padding: 4px;">${user.name}</td>`;
            rowHtml += `<td style="text-align: center; font-weight: 600; padding: 4px;">${proof || '-'}</td>`;
            rowHtml += `<td style="text-align: center; font-weight: 600; padding: 4px;">${epub || '-'}</td>`;
            rowHtml += `<td style="text-align: center; font-weight: 600; padding: 4px;">${calibr || '-'}</td>`;

            if (isLeave) {
                rowHtml += `<td colspan="${this.timeSlots.length}" style="background: #fee2e2; color: #991b1b; font-weight: bold; text-align: center; vertical-align: middle;">ON LEAVE</td>`;
            } else {
                this.timeSlots.forEach(slot => {
                    const acts = userSlots[slot];
                    let cellContent = '';
                    if (acts && acts.length > 0) {
                        cellContent += `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">`;
                        acts.forEach(act => {
                            // Minimalist render for report
                            if (act.type === 'sunday-holiday') {
                                cellContent += `<div style="background: #f0fdf4; color: #166534; padding: 2px 4px; border-radius: 4px; font-size: 9px; margin-bottom: 2px; text-align: center; width: 100%;">Sunday Holiday</div>`;
                            } else if (act.type === 'lunch-break') {
                                cellContent += `<div style="background: #ffedd5; color: #9a3412; padding: 2px 4px; border-radius: 4px; font-size: 9px; margin-bottom: 2px; text-align: center; width: 100%;">Lunch Break</div>`;
                            } else {
                                cellContent += `<div style="margin-bottom: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px; width: 100%; text-align: center;">
                                    <div style="font-weight: 700; font-size: 10px; color: #0f172a; text-transform: uppercase;">${act.type}</div>
                                    <div style="font-size: 9px; color: #64748b; line-height: 1.2;">${act.description || ''}</div>
                                 </div>`;
                            }
                        });
                        cellContent += `</div>`;
                    }
                    rowHtml += `<td style="vertical-align: top; padding: 4px; height: 40px;">${cellContent}</td>`;
                });
            }
            rowHtml += `</tr>`;
            return rowHtml;
        }).join('');

        printWindow.document.write(`
            <html>
            <head>
                <title>Daily Timesheet Report - ${dateKey}</title>
                <style>
                    body { font-family: 'Inter', 'Segoe UI', sans-serif; padding: 20px; color: #0f172a; background: white; -webkit-print-color-adjust: exact; }
                    
                    /* Header */
                    .report-header { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #d4af37; }
                    h1 { color: #1e3a8a; margin: 0; font-size: 20px; }
                    .meta { font-size: 12px; color: #64748b; margin-top: 5px; }

                    /* Landscape Table */
                    @page { size: landscape; margin: 10mm; }
                    
                    table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
                    th, td { border: 1px solid #cbd5e1; padding: 4px; word-wrap: break-word; overflow-wrap: break-word; }
                    th { background: #f1f5f9; color: #1e3a8a; font-weight: 600; text-align: center; vertical-align: middle; }
                    tr:nth-child(even) { background: #f8fafc; }
                    
                    /* Buttons */
                    .no-print { margin-bottom: 15px; text-align: right; }
                    .btn { padding: 8px 16px; background: #1e3a8a; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; }
                    .btn-sec { background: white; color: #1e3a8a; border: 1px solid #1e3a8a; margin-right: 10px; }
                    @media print { .no-print { display: none; } body { padding: 0; } }
                </style>
            </head>
            <body>
                <div class="no-print">
                    <a href="mailto:?subject=Timesheet Report ${dateKey}" class="btn btn-sec">📧 Send Email</a>
                    <button class="btn" onclick="window.print()">🖨️ Print Landscape</button>
                </div>

                <div class="report-header">
                    <h1>Pristonix Daily Timesheet</h1>
                    <div class="meta">Date: ${dateStr} | Generated By: ${this.currentUser.name} | Confidential</div>
                </div>

                <table>
                    <thead>
                        <tr>${tableHeaderCols}</tr>
                        ${secondHeaderRow}
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                
                <div style="margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: center;">
                    Generated by Pristonix Timesheet System
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    generateDailyReport_OLD() {
        const dateKey = this.getDateKey(this.currentDate);
        const dateStr = this.currentDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // Filter users
        const users = this.employees.filter(u => u.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name));
        const reportData = [];

        users.forEach(user => {
            const slots = this.activities[dateKey]?.[user.id] || {};

            // Check Sunday/Holiday auto-fill for report if not in slots
            /* (Logic handled by renderTimesheet mostly, but we should access raw if possible or just check slots) */

            this.timeSlots.forEach(slot => {
                const acts = slots[slot]; // Array
                if (Array.isArray(acts) && acts.length > 0) {
                    acts.forEach(act => {
                        reportData.push({
                            timeSlot: slot,
                            employeeName: user.name,
                            type: act.type,
                            description: act.description,
                            pagesDone: act.pagesDone,
                            timestamp: act.timestamp
                        });
                    });
                }
            });
        });

        if (reportData.length === 0) {
            this.showStatus('No data to report for this date', 'error');
            return;
        }

        // Open Report Window
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to generate the report.');
            return;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Daily Activity Report - ${dateKey}</title>
                <style>
                    body { font-family: 'Inter', 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; background: white; -webkit-print-color-adjust: exact; }
                    
                    /* Header */
                    .report-header { border-bottom: 2px solid #d4af37; padding-bottom: 20px; margin-bottom: 30px; }
                    .report-title { color: #1e3a8a; font-size: 24px; font-weight: 700; margin: 0 0 5px 0; }
                    .report-meta { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; }
                    .meta-group { font-size: 13px; line-height: 1.6; color: #64748b; }
                    .meta-label { font-weight: 600; color: #475569; }

                    /* Table */
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    th { text-align: left; padding: 12px 15px; background: #f1f5f9; color: #334155; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
                    td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #334155; }
                    tr:last-child td { border-bottom: none; }
                    tr:hover { background-color: #f8fafc; }

                    /* Column Styles */
                    .col-timeslot { width: 15%; font-weight: 600; color: #64748b; font-variant-numeric: tabular-nums; }
                    .col-employee { width: 20%; font-weight: 600; color: #1e3a8a; }
                    .col-details { width: 45%; }
                    .col-updated { width: 20%; color: #94a3b8; font-size: 12px; }

                    /* Activity Details Cell */
                    .act-type { display: block; font-weight: 700; color: #0f172a; margin-bottom: 4px; text-transform: uppercase; font-size: 11px; }
                    .act-desc { display: block; margin-bottom: 4px; line-height: 1.4; }
                    .act-pages { display: block; color: #64748b; font-size: 12px; }
                    
                    /* Badges for Type Colors if needed, or just text */
                    .type-proof { color: #15803d; }
                    .type-epub { color: #1d4ed8; }
                    .type-calibr { color: #7e22ce; }
                    .type-lunch-break { color: #c2410c; }
                    .type-sunday-holiday { color: #047857; }

                    /* Footer */
                    .footer { margin-top: 50px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }

                    /* Print */
                    @media print {
                        .no-print { display: none !important; }
                        body { padding: 0; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                    }

                    .btn { padding: 10px 20px; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; font-size: 14px; transition: all 0.2s; }
                    .btn-primary { background: #1e3a8a; color: white; }
                    .btn-primary:hover { background: #1e40af; }
                    .btn-secondary { background: #fff; color: #1e3a8a; border: 1px solid #1e3a8a; }
                    .btn-secondary:hover { background: #f0f9ff; }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 30px; display: flex; gap: 10px; justify-content: flex-end; align-items: center;">
                    <span style="font-size: 12px; color: #64748b; margin-right: 10px; font-weight: 500;">
                        ℹ️ Clicking 'Send Report' will copy the table. Just Paste (Ctrl+V) in the email body.
                    </span>
                    <button class="btn btn-secondary" onclick="sendEmailReport()">
                        📧 Send Report
                    </button>
                    <button class="btn btn-primary" onclick="window.print()">
                        🖨️ Print / Save PDF
                    </button>
                </div>
                
                <script>
                    function sendEmailReport() {
                        // 1. Copy to Clipboard
                        const table = document.querySelector('table');
                        const range = document.createRange();
                        range.selectNode(table);
                        window.getSelection().removeAllRanges();
                        window.getSelection().addRange(range);
                        try {
                            document.execCommand('copy');
                        } catch (err) {
                            console.error('Copy failed', err);
                        }
                        window.getSelection().removeAllRanges();

                        // 2. Open Mail Client
                        const subject = encodeURIComponent("Daily Activity Report - ${dateKey}");
                        const body = encodeURIComponent("Hi Team,\n\nPlease find the Daily Activity Report below:\n\n[PASTE (Ctrl+V) TABLE HERE]\n\nRegards,\n${this.currentUser.name || 'Admin'}");
                        window.location.href = "mailto:?subject=" + subject + "&body=" + body;
                    }
                </script>

                <div class="report-header">
                    <h1 class="report-title">Pristonix Daily Activity Report</h1>
                    <div class="report-meta">
                        <div class="meta-group">
                            <span class="meta-label">Date:</span> ${dateStr}<br>
                            <span class="meta-label">Generated By:</span> ${this.currentUser.name || 'Admin'}
                        </div>
                        <div class="meta-group" style="text-align: right;">
                            <span class="meta-label">Total Records:</span> ${reportData.length}<br>
                            <span class="meta-label">Confidentiality:</span> Internal Use Only
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Time Slot</th>
                            <th>Employee</th>
                            <th>Activity Details</th>
                            <th>Last Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.map(row => {
            // Extract time from ISO timestamp
            const time = row.timestamp ? new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
            return `
                            <tr>
                                <td class="col-timeslot">${row.timeSlot}</td>
                                <td class="col-employee">${row.employeeName}</td>
                                <td class="col-details">
                                    <span class="act-type type-${row.type}">${row.type}</span>
                                    <span class="act-desc">${row.description || 'No description'}</span>
                                    ${parseInt(row.pagesDone) > 0 ? `<span class="act-pages">Pages: ${row.pagesDone}</span>` : ''}
                                </td>
                                <td class="col-updated">${time}</td>
                            </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    © 2025 Pristonix Solutions. All Rights Reserved. | Generated on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    calculateTotal() {
        const start = parseInt(document.getElementById('startPage')?.value) || 0;
        const end = parseInt(document.getElementById('endPage')?.value) || 0;
        const total = (end >= start && start > 0) ? (end - start + 1) : 0;
        const calcField = document.getElementById('calculatedTotal');
        if (calcField) calcField.value = total;
    }
}

class ActivityTracker {
    constructor() {
        this.listElement = null;
        // We'll init after a short delay or find element dynamically
        setTimeout(() => this.init(), 500);
    }

    async init() {
        await this.loadLogs();
        // Poll every 30 seconds
        setInterval(() => this.loadLogs(), 30000);
    }

    async loadLogs(dateKey = null) {
        // Access global manager for user info
        const manager = window.timesheetManager;
        const currentUser = manager ? manager.currentUser : JSON.parse(localStorage.getItem('currentUser') || '{}');

        // If no specific date passed, try to get from manager
        const date = dateKey || (manager ? manager.getDateKey(manager.currentDate) : null);

        // Update Header to show context
        const header = document.getElementById('recentChangesHeader');
        if (header) {
            if (currentUser.role !== 'admin') {
                header.textContent = 'My Recent Activity';
            } else if (date) {
                header.textContent = `Recent Changes (${date})`;
            } else {
                header.textContent = 'Recent Changes';
            }
        }

        let url = '/api/activity-log?limit=50';
        if (date) url += `&date=${date}`;

        // Employee Filtering: If not admin, ONLY show own logs
        if (currentUser.role !== 'admin' && currentUser.name) {
            url += `&employeeName=${encodeURIComponent(currentUser.name)}`;
        }

        try {
            const res = await fetch(url);
            if (res.ok) {
                const logs = await res.json();
                this.render(logs);
            }
        } catch (e) {
            console.error('Failed to load activity log', e);
        }
    }

    render(logs) {
        const output = document.getElementById('activityTrackerList') || document.querySelector('.activity-tracker-list');
        if (!output) return;

        output.innerHTML = '';
        if (logs.length === 0) {
            output.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #94a3b8;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;">📭</div>
                    <div>No activities found</div>
                </div>
            `;
            return;
        }

        logs.forEach(log => {
            const item = document.createElement('div');
            item.className = 'activity-item-wrapper';

            // Format time
            const timeDate = new Date(log.timestamp);
            const timeStr = timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Data Fallbacks
            const employeeName = log.employeeName || log.employeename || 'Unknown';
            const activityType = (log.activityType || log.activitytype || 'other').toLowerCase();
            const description = log.description || '';
            const timeSlot = log.timeSlot || log.timeslot || '';
            // Only show "Edited by" if it differs from the employee
            const editedBy = log.editedBy || log.editedby || 'System';
            const showEditor = editedBy !== employeeName && editedBy !== 'System';

            // Logic for nice display
            const niceTypeLabel = activityType.charAt(0).toUpperCase() + activityType.slice(1);

            // Extract just the time part of slot "2025-01-01 | 9:00-10:00" -> "9:00-10:00"
            const slotDisplay = timeSlot.includes('|') ? timeSlot.split('|').pop().trim() : timeSlot;

            item.innerHTML = `
                <div class="activity-dot type-${activityType}"></div>
                <div class="activity-card">
                    <div class="activity-header">
                        <div class="user-info">
                            <div class="user-avatar" title="${employeeName}">
                                ${employeeName.charAt(0).toUpperCase()}
                            </div>
                            <span class="user-name">${employeeName}</span>
                        </div>
                        <span class="activity-time">${timeStr}</span>
                    </div>
                    
                    <div class="activity-body">
                         <div style="margin-bottom: 4px;">
                            <span class="type-tag tag-${activityType}">${niceTypeLabel}</span>
                         </div>
                         <div class="activity-desc">
                            ${description || log.action}
                         </div>
                    </div>

                    <div class="activity-meta">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>${slotDisplay}</span>
                        ${showEditor ? `<span style="margin-left: auto; color: #f59e0b; font-size: 0.7rem;">By: ${editedBy}</span>` : ''}
                    </div>
                </div>
            `;
            output.appendChild(item);
        });
    }

    async addActivity(name, type, desc, slot, action, dateKeyOverride = null) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const editorName = currentUser.name || currentUser.username || 'System';

        // Extract dateKey from slot if present (format: "YYYY-MM-DD | HH:MM-HH:MM")
        // Used for strict date filtering in backend
        let dateKey = dateKeyOverride;
        if (!dateKey) {
            if (slot && slot.includes(' | ')) {
                dateKey = slot.split(' | ')[0];
            } else {
                // Fallback for immediate safety, though setActivity should provide it.
                // If missing, it might not show in date-filtered view, which is better than showing in WRONG view.
                dateKey = new Date().toISOString().split('T')[0];
            }
        }

        try {
            await fetch('/api/activity-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeName: name,
                    activityType: type,
                    description: desc,
                    timeSlot: slot, // Keeps full display "Date | Time"
                    action: action,
                    editedBy: editorName,
                    timestamp: new Date().toISOString(),
                    dateKey: dateKey
                })
            });
            this.loadLogs(dateKey); // Reload logs for the specific date we just added to
        } catch (e) {
            console.error('Error logging activity', e);
        }
    }
}

window.timesheetManager = new TimesheetManager();
window.activityTracker = new ActivityTracker();
