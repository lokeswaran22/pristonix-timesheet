class HistoryManager {
    constructor() {
        this.rawLogs = [];
        this.init();
    }

    async init() {
        const isHistoryPage = window.location.pathname.includes('history.html');

        if (isHistoryPage) {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const role = currentUser.role;

            if (role !== 'admin') {
                alert('Access Denied: Full admin privileges required.');
                window.location.href = 'index.html';
                return;
            }

            // Only initialize these on the history page
            this.setupEventListeners();
            this.loadLogs();
        }
    }



    async loadLogs() {
        this.showLoading(true);
        try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const role = currentUser.role || 'guest';
            const res = await fetch(`/api/audit/history?limit=200&requesterRole=${role}`);

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${res.status}`);
            }

            this.rawLogs = await res.json();
            this.renderTable(this.rawLogs);
        } catch (err) {
            console.error('History Fetch Error:', err);
            const noData = document.getElementById('noDataState');
            if (noData) {
                noData.textContent = `Error loading history: ${err.message}. Ensure server is running.`;
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

            // Format Time as DD-MM-YYYY HH:MM:SS
            const dateObj = new Date(log.action_timestamp);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            const seconds = String(dateObj.getSeconds()).padStart(2, '0');
            const timeStr = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;

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

        const deleteLogsBtn = document.getElementById('deleteLogsBtn');
        const deleteLogsModal = document.getElementById('deleteLogsModal');
        const deleteLogsForm = document.getElementById('deleteLogsForm');
        const closeDeleteModal = document.getElementById('closeDeleteModal');
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        const delClearAll = document.getElementById('delClearAll');
        const deleteError = document.getElementById('deleteError');

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

        if (reportBtn) reportBtn.addEventListener('click', () => this.generateComplianceReport());

        if (deleteLogsBtn) {
            deleteLogsBtn.addEventListener('click', () => {
                deleteLogsModal.style.display = 'flex';
                deleteLogsForm.reset();
                deleteError.style.display = 'none';

                // Set default dates if available
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('delEndDate').value = today;
            });
        }

        const closeDelete = () => { deleteLogsModal.style.display = 'none'; };
        if (closeDeleteModal) closeDeleteModal.onclick = closeDelete;
        if (cancelDeleteBtn) cancelDeleteBtn.onclick = closeDelete;

        if (deleteLogsForm) {
            deleteLogsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                deleteError.style.display = 'none';

                const startDate = document.getElementById('delStartDate').value;
                const endDate = document.getElementById('delEndDate').value;
                const name = document.getElementById('delName').value;
                const clearAll = document.getElementById('delClearAll').checked;
                const submitBtn = deleteLogsForm.querySelector('button[type="submit"]');

                if (!clearAll && !startDate && !endDate && !name) {
                    deleteError.textContent = "Please select a date range, name, or check 'Delete Everything'.";
                    deleteError.style.display = 'block';
                    return;
                }

                // Double Confirmation Logic to replace native confirm()
                if (submitBtn.getAttribute('data-confirming') !== 'true') {
                    // First Click: Switch to Confirmation State
                    submitBtn.setAttribute('data-confirming', 'true');
                    submitBtn.innerHTML = '⚠️ Are you sure? Click again';
                    submitBtn.style.backgroundColor = '#b91c1c'; // Darker red

                    // Auto-reset button if not clicked again within 3 seconds
                    setTimeout(() => {
                        if (submitBtn.getAttribute('data-confirming') === 'true') {
                            submitBtn.removeAttribute('data-confirming');
                            submitBtn.innerHTML = 'Confirm Delete';
                            submitBtn.style.backgroundColor = ''; // Reset to default class style
                        }
                    }, 3000);
                    return; // Stop here and wait for second click
                }

                // Second Click: Proceed with deletion
                const originalBtnText = submitBtn.innerHTML;
                submitBtn.innerHTML = 'Deleting...';
                submitBtn.disabled = true;
                submitBtn.removeAttribute('data-confirming');

                const params = new URLSearchParams();
                if (clearAll) params.append('clearAll', 'true');
                if (startDate) params.append('startDate', startDate);
                if (endDate) params.append('endDate', endDate);
                if (name) params.append('name', name);

                try {
                    const res = await fetch(`/api/audit/history?${params.toString()}`, {
                        method: 'DELETE'
                    });
                    const data = await res.json();

                    if (res.ok) {
                        alert(data.message || 'Logs deleted successfully.');
                        closeDelete();
                        this.loadLogs(); // Refresh table
                    } else {
                        deleteError.textContent = data.error || 'Failed to delete logs.';
                        deleteError.style.display = 'block';
                    }
                } catch (err) {
                    deleteError.textContent = 'Network error occurred.';
                    deleteError.style.display = 'block';
                } finally {
                    submitBtn.innerHTML = 'Confirm Delete'; // Reset text
                    submitBtn.disabled = false;
                    submitBtn.style.backgroundColor = '';
                }
            });
        }
    }

    showLoading(show) {
        const el = document.getElementById('loadingState');
        if (el) el.style.display = show ? 'block' : 'none';
    }

    generateComplianceReport() {
        const filtered = this.getFilteredLogs();
        const dateStr = window.formatDate ? window.formatDate(new Date()) : new Date().toLocaleDateString();

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
                        <strong>Date:</strong> ${window.formatDateTime ? window.formatDateTime(new Date()) : new Date().toLocaleString()}
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

            // Format timestamp as DD-MM-YYYY HH:MM:SS
            const dateObj = new Date(log.action_timestamp);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            const seconds = String(dateObj.getSeconds()).padStart(2, '0');
            const time = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;

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
