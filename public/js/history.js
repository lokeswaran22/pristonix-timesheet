class HistoryManager {
    constructor() {
        this.rawLogs = [];
        this.init();
    }

    async init() {
        // Security Check
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const role = currentUser.role;
        if (role !== 'admin') {
            alert('Access Denied: Admin privileges required.');
            window.location.href = 'index.html';
            return;
        }

        this.setupEventListeners();
        await this.loadLogs();
        this.loadDashboardAnalytics();
    }

    async loadDashboardAnalytics() {
        const date = new Date().toISOString().split('T')[0]; // Today
        console.log(`Loading Dashboard for date: ${date}`);

        // Set Loading State
        document.getElementById('dashStatEmp').textContent = '...';
        document.getElementById('dashStatAct').textContent = '...';

        try {
            const [sumRes, chartRes] = await Promise.all([
                fetch(`/api/analytics/summary?date=${date}`),
                fetch(`/api/analytics/charts?date=${date}`)
            ]);

            console.log('Dashboard Data Responses:', sumRes.status, chartRes.status);

            if (sumRes.ok) {
                const summary = await sumRes.json();
                const elEmp = document.getElementById('dashStatEmp');
                const elAct = document.getElementById('dashStatAct');
                const elPages = document.getElementById('dashStatPages');
                if (elEmp) elEmp.textContent = summary.employees || '0';
                if (elAct) elAct.textContent = summary.activities || '0';
                if (elPages) elPages.textContent = summary.totalPages || '0';
            } else {
                console.error('Summary API Failed');
                document.getElementById('dashStatEmp').textContent = 'Err';
            }

            if (chartRes.ok) {
                const data = await chartRes.json();
                console.log('Chart Data:', data);
                if (!window.Chart) {
                    console.error('Chart.js library not found!');
                    return;
                }
                this.renderCharts(data);
            }
        } catch (e) {
            console.error('Dashboard Error:', e);
            document.getElementById('dashStatEmp').textContent = 'Err';
        }
    }

    renderCharts(data) {
        if (window.dashCharts) window.dashCharts.forEach(c => c.destroy());
        window.dashCharts = [];
        const ctx1 = document.getElementById('dashProdChart');
        const ctx2 = document.getElementById('dashTypeChart');
        if (!ctx1 || !ctx2) return;
        const col = '#1e3a8a';

        if (data.productivity) {
            window.dashCharts.push(new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: data.productivity.map(d => d.name),
                    datasets: [{
                        label: 'Pages',
                        data: data.productivity.map(d => d.totalPages),
                        backgroundColor: col,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            }));
        }
        if (data.distribution) {
            window.dashCharts.push(new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: data.distribution.map(d => d.type),
                    datasets: [{
                        data: data.distribution.map(d => d.count),
                        backgroundColor: ['#1e3a8a', '#d4af37', '#10b981', '#ef4444']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            }));
        }
    }

    async loadLogs() {
        this.showLoading(true);
        try {
            // Fetch audit logs with limit & role context
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const res = await fetch(`/api/audit/history?limit=200&requesterRole=${currentUser.role}`);
            if (!res.ok) throw new Error('Failed to load logs');

            this.rawLogs = await res.json();
            this.renderTable(this.rawLogs);
        } catch (err) {
            console.error(err);
            const noData = document.getElementById('noDataState');
            if (noData) {
                noData.textContent = 'Error loading history. Ensure server is running.';
                noData.style.display = 'block';
            }
        } finally {
            this.showLoading(false);
        }
    }

    renderTable(logs) {
        const tbody = document.getElementById('historyBody');
        const noData = document.getElementById('noDataState');

        if (!tbody) return;
        tbody.innerHTML = '';

        if (logs.length === 0) {
            if (noData) noData.style.display = 'block';
            return;
        }
        if (noData) noData.style.display = 'none';

        logs.forEach(log => {
            const row = document.createElement('tr');

            // Format Time
            const dateObj = new Date(log.action_timestamp);
            const timeStr = dateObj.toLocaleString();

            // Action Badge
            let actionClass = 'other'; // Gray default
            if (log.action_type === 'CREATE') actionClass = 'proof'; // Green
            if (log.action_type === 'DELETE') actionClass = 'lunch'; // Red
            if (log.action_type === 'UPDATE') actionClass = 'calibr'; // Purple

            const actionBadge = `<span class="badge ${actionClass}">${log.action_type}</span>`;

            // Details Extraction
            let details = '';
            let slot = log.time_slot;

            // Prefer new_data (create/update), fallback to old_data (delete)
            const data = log.new_data || log.old_data || {};

            if (data.type) details += `<span style="font-weight:600">${data.type}</span>`;
            if (data.description) details += `<div style="font-size:0.9em; color:#475569">${data.description}</div>`;
            if (data.pagesDone) details += `<div style="font-size:0.85em; margin-top:2px">Pages: ${data.pagesDone}</div>`;

            // User Name
            const userName = log.userName || `User #${log.user_id}`;

            // Action By
            const doneBy = log.actionByName || (log.action_by === log.user_id ? 'Self' : `User #${log.action_by}`);

            row.innerHTML = `
                 <td style="font-size: 0.85em; white-space: nowrap; color: var(--text-secondary);">${timeStr}</td>
                 <td style="font-weight: 500; color: var(--royal-navy);">${userName}</td>
                 <td>${actionBadge}</td>
                 <td style="font-size: 0.9em;">
                    <div style="font-weight:600">${log.date_key}</div>
                    <div style="color:var(--text-muted)">${slot}</div>
                 </td>
                 <td>${details}</td>
                 <td style="font-size: 0.9em;">${doneBy}</td>
                 <td style="font-size: 0.75em; color: var(--text-muted); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="IP: ${log.ip_address}">
                    IP: ${log.ip_address}
                 </td>
             `;
            tbody.appendChild(row);
        });
    }

    getFilteredLogs() {
        const searchInput = document.getElementById('searchFilter');
        const term = searchInput ? searchInput.value.toLowerCase() : '';

        // Also respect date filters if I had implemented them fully client side. 
        // For now, mirroring the client search filter.

        return this.rawLogs.filter(log => {
            const data = log.new_data || log.old_data || {};
            const desc = data.description || '';
            const type = data.type || '';
            const user = log.userName || '';

            return user.toLowerCase().includes(term) ||
                type.toLowerCase().includes(term) ||
                desc.toLowerCase().includes(term) ||
                log.action_type.toLowerCase().includes(term);
        });
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchFilter');
        const resetBtn = document.getElementById('resetFilters');
        const reportBtn = document.getElementById('generateReportBtn');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const filtered = this.getFilteredLogs();
                this.renderTable(filtered);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                this.renderTable(this.rawLogs);
            });
        }

        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                this.generateComplianceReport();
            });
        }
    }

    showLoading(show) {
        const el = document.getElementById('loadingState');
        if (el) el.style.display = show ? 'block' : 'none';
    }

    generateComplianceReport() {
        const filtered = this.getFilteredLogs();
        const dateStr = new Date().toLocaleDateString();

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to generate the report.');
            return;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Compliance Report - ${dateStr}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
                    h1 { color: #1e3a8a; border-bottom: 2px solid #d4af37; padding-bottom: 15px; font-size: 24px; margin-bottom: 20px; }
                    .header-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; color: #666; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background-color: #f1f5f9; color: #1e3a8a; font-weight: 600; text-transform: uppercase; font-size: 11px; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .badge { display: inline-block; padding: 3px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
                    .badge-CREATE { background: #dcfce7; color: #15803d; }
                    .badge-DELETE { background: #fee2e2; color: #b91c1c; }
                    .badge-UPDATE { background: #f3e8ff; color: #7e22ce; }
                    .footer { margin-top: 40px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
                </style>
            </head>
            <body>
                <h1>Pristonix Compliance Report</h1>
                
                <div class="header-info">
                    <div>
                        <strong>Generated By:</strong> Admin System<br>
                        <strong>Date:</strong> ${new Date().toLocaleString()}
                    </div>
                    <div style="text-align: right;">
                        <strong>Total Records:</strong> ${filtered.length}<br>
                        <strong>Confidentiality:</strong> Internal Use Only
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 15%;">Timestamp</th>
                            <th style="width: 15%;">Employee</th>
                            <th style="width: 10%;">Action</th>
                            <th style="width: 15%;">Time Slot</th>
                            <th style="width: 30%;">Activity Details</th>
                            <th style="width: 15%;">Authorized By</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(log => {
            const data = log.new_data || log.old_data || {};
            const user = log.userName || log.user_id;
            const by = log.actionByName || (log.action_by === log.user_id ? 'Self' : log.action_by);
            const time = new Date(log.action_timestamp).toLocaleString();

            let details = `<strong>${data.type || '-'}</strong>`;
            if (data.description) details += `<br>${data.description}`;
            if (data.pagesDone) details += `<br>Pages: ${data.pagesDone}`;

            return `
                                <tr>
                                    <td>${time}</td>
                                    <td><strong>${user}</strong></td>
                                    <td><span class="badge badge-${log.action_type}">${log.action_type}</span></td>
                                    <td>${log.date_key}<br>${log.time_slot}</td>
                                    <td>${details}</td>
                                    <td>${by}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    Generated automatically by Pristonix Timesheet System. Valid without signature.
                </div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
}

// document.addEventListener('DOMContentLoaded', () => {
//     new HistoryManager();
// });
window.HistoryManager = HistoryManager;
