// Global Date/Time Formatting Utility
// Format: DD-MM-YYYY HH:MM:SS

window.formatDateTime = function (dateInput) {
    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

window.formatDate = function (dateInput) {
    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();

    return `${day}-${month}-${year}`;
};

window.formatTime = function (dateInput) {
    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);

    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
};
