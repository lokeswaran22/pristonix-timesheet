// Authentication Check - Must be loaded first
(function () {
    'use strict';

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
        }
        return;
    }

    // If not on login page and not logged in, redirect to login
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }

    // Expose Logout Globally Immediately
    // Expose Logout Globally with Animation
    window.handleLogoutWithAnimation = function (e) {
        if (e && e.preventDefault) e.preventDefault();

        if (confirm('Are you sure you want to logout?')) {
            const overlay = document.getElementById('logoutOverlay');
            if (overlay) {
                overlay.style.display = 'flex'; // Ensure flex display
                // Force reflow
                void overlay.offsetWidth;
                overlay.classList.add('active');

                // Wait for animation
                setTimeout(() => {
                    performFinalLogout();
                }, 2000);
            } else {
                performFinalLogout();
            }
        }
    };

    function performFinalLogout() {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    }

    // Display user info in header
    window.addEventListener('DOMContentLoaded', function () {
        const userInfoDisplay = document.getElementById('userInfoDisplay');
        if (userInfoDisplay && currentUser) {
            let bg = 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)'; // Employee Blue
            if (currentUser.role === 'admin') bg = 'linear-gradient(135deg, #d4af37 0%, #aa8c2c 100%)'; // Admin Gold

            userInfoDisplay.innerHTML = `
                <span style="
                    background: ${bg};
                    color: white;
                    padding: 0.4rem 0.8rem;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                ">
                    ${currentUser.username} (${currentUser.role})
                </span>
            `;
        }

        // Cleanup Logout Button: We rely on HTML onclick="performLogout(event)"
        // This is simple and robust. No need to interfere via JS.
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            console.log('Logout button found, using inline onclick');
        }
    });
})();
