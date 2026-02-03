/* ============================================================
   Modal Management
   ============================================================ */

/**
 * Open a modal by ID
 * @param {string} modalId - ID of the modal element (without #)
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        // Focus first focusable element
        const focusable = modal.querySelector('input, textarea, button, select');
        if (focusable) {
            setTimeout(() => focusable.focus(), 50);
        }
    }
}

/**
 * Close a modal by ID
 * @param {string} modalId - ID of the modal element (without #)
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Close all open modals
 */
export function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
    });
}

/**
 * Initialize modal behaviors (escape key, click outside)
 * Call this once on DOMContentLoaded
 */
export function initModals() {
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // Close on click outside
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
}

/**
 * Setup a modal close button
 * @param {HTMLElement} button - Close button element
 * @param {string} modalId - ID of the modal to close
 */
export function setupCloseButton(button, modalId) {
    button.addEventListener('click', () => closeModal(modalId));
}

/**
 * Tab switching functionality
 * @param {string} tabId - ID of the tab content to show
 * @param {HTMLElement} clickedTab - The tab button that was clicked
 */
export function switchTab(tabId, clickedTab) {
    // Deactivate all tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Activate clicked tab
    clickedTab.classList.add('active');
    const content = document.getElementById(tabId);
    if (content) {
        content.classList.add('active');
    }
}
