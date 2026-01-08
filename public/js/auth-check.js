// Authentication Check - Must be loaded first
(function () {
    'use strict';

    // Hide page content initially to prevent flash
    document.documentElement.style.visibility = 'hidden';

    // Check if user is logged in
    let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

    // Session Expiry Check (10 Hours)
    if (currentUser && currentUser.expiry) {
        if (new Date().getTime() > currentUser.expiry) {
            localStorage.removeItem('currentUser');
            currentUser = null; // Invalidate session in memory

            if (!window.location.pathname.includes('login.html')) {
                alert('Session expired. Please login again.');
                window.location.href = '/login.html';
                return;
            }
        }
    }

    // If on login page, redirect to home if already logged in (and valid)
    if (window.location.pathname.includes('login.html')) {
        if (currentUser) {
            window.location.href = '/';
        } else {
            // Show login page
            document.documentElement.style.visibility = 'visible';
        }
        return;
    }

    // If not on login page and not logged in, redirect to login
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }

    // Authentication passed - show page content
    document.documentElement.style.visibility = 'visible';

    // Expose Logout Globally Immediately
    // Expose Logout Globally with Animation
    window.handleLogoutWithAnimation = function (e) {
        if (e && e.preventDefault) e.preventDefault();

        const logoutModal = document.getElementById('logoutConfirmModal');
        if (logoutModal) {
            logoutModal.style.display = 'flex';
        } else {
            // Fallback for pages without the custom modal
            if (confirm('Are you sure you want to logout?')) {
                performFinalLogoutWithOverlay();
            }
        }
    };

    function performFinalLogoutWithOverlay() {
        const overlay = document.getElementById('logoutOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            void overlay.offsetWidth;
            overlay.classList.add('active');
            setTimeout(() => performFinalLogout(), 2000);
        } else {
            performFinalLogout();
        }
    }

    function performFinalLogout() {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    }

    // Proactive Event Listener for Logout
    document.addEventListener('DOMContentLoaded', function () {
        const logoutBtn = document.getElementById('logoutBtn');
        const confirmBtn = document.getElementById('confirmLogoutBtn');
        const cancelBtn = document.getElementById('cancelLogoutBtn');
        const logoutModal = document.getElementById('logoutConfirmModal');

        if (logoutBtn) {
            console.log('✅ Logout button found. Attaching robust listener.');
            logoutBtn.addEventListener('click', function (e) {
                console.log('🚪 Logout clicked (custom modal triggered)');
                window.handleLogoutWithAnimation(e);
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (logoutModal) logoutModal.style.display = 'none';
                performFinalLogoutWithOverlay();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (logoutModal) logoutModal.style.display = 'none';
            });
        }
    });
})();
