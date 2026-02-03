/* ============================================================
   Shared Utilities
   ============================================================ */

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

/**
 * Download text content as a file
 * @param {string} filename - Name of the file to download
 * @param {string} content - Content to download
 * @param {string} mimeType - MIME type (default: text/plain)
 */
export function downloadText(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Download JSON data as a file
 * @param {string} filename - Name of the file to download
 * @param {any} data - Data to serialize to JSON
 */
export function downloadJson(filename, data) {
    const content = JSON.stringify(data, null, 2);
    downloadText(filename, content, 'application/json');
}

/**
 * Format a date as a relative time string
 * @param {string|Date} datetime - Date to format
 * @returns {string} Formatted date string
 */
export function formatRelativeDate(datetime) {
    const d = new Date(datetime);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const entryDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (entryDay.getTime() === today.getTime()) {
        return `Today at ${time}`;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (entryDay.getTime() === yesterday.getTime()) {
        return `Yesterday at ${time}`;
    }

    return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }) + ` at ${time}`;
}

/**
 * Format a number as currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: EUR)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'EUR') {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
}

/**
 * Generate a unique ID
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Unique ID
 */
export function generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Storage wrapper with JSON parsing
 */
export const storage = {
    get(key, defaultValue = null) {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (e) {
            console.error(`Error reading ${key} from storage:`, e);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Error saving ${key} to storage:`, e);
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error(`Error removing ${key} from storage:`, e);
            return false;
        }
    }
};
