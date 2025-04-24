// Shared utility functions

/**
 * Utility functions shared across the application
 */

/**
 * Display a toast notification
 */
function showToast(title, message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Set icon based on type
    const iconClass = 
        type === 'success' ? 'fa-check-circle' : 
        type === 'error' ? 'fa-exclamation-circle' : 
        type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    // Toast content
    toast.innerHTML = `
        <div class="toast-header">
            <i class="fas ${iconClass}"></i>
            <strong>${title}</strong>
            <button class="toast-close">&times;</button>
        </div>
        <div class="toast-body">${message}</div>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Add close button functionality
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    });
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

/**
 * Formats a timestamp into a readable date string
 * @param {Timestamp} timestamp - Firebase timestamp
 * @param {boolean} includeTime - Whether to include the time
 * @returns {string} Formatted date string
 */
function formatDate(timestamp, includeTime = false) {
    if (!timestamp || !timestamp.toDate) {
        return 'N/A';
    }
    
    const date = timestamp.toDate();
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
    };
    
    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    
    return date.toLocaleDateString('en-US', options);
}

/**
 * Formats time elapsed since a timestamp
 * @param {Timestamp} timestamp - Firebase timestamp
 * @returns {string} Time elapsed string
 */
function timeElapsed(timestamp) {
    if (!timestamp || !timestamp.toDate) {
        return '';
    }
    
    const now = new Date();
    const then = timestamp.toDate();
    const diffMs = now - then;
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) {
        return diffMins === 0 ? 'just now' : `${diffMins}m ago`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
}

/**
 * Validates an email address
 * @param {string} email - Email to validate
 * @returns {boolean} Whether the email is valid
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Sets error text on a form field
 * @param {string} elementId - ID of error display element
 * @param {string} message - Error message
 */
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = message ? 'block' : 'none';
    }
}

/**
 * Creates an element with the user's initials as avatar
 * @param {string} name - User's name
 * @param {string} color - Background color (hex code)
 * @returns {HTMLElement} The avatar element
 */
function createUserAvatar(name, color = '#2196F3') {
    const initials = name ? name.charAt(0).toUpperCase() : '?';
    
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = initials;
    avatar.style.backgroundColor = color;
    
    return avatar;
}

/**
 * Truncates text if it exceeds a certain length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 30) {
    if (!text || text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

/**
 * Formats distance in meters to a readable string
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance
 */
function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Creates a classroom code
 * @returns {string} 6-character alphanumeric code
 */
function generateClassroomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Check if a user has the required role
 * @param {Object} user - Firebase user object
 * @param {string} requiredRole - Role to check for
 * @returns {Promise<boolean>} Whether user has the role
 */
async function checkUserRole(user, requiredRole) {
    if (!user) return false;
    
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (!doc.exists) return false;
        
        const userData = doc.data();
        return userData.role === requiredRole;
    } catch (error) {
        console.error("Error checking user role:", error);
        return false;
    }
}

/**
 * Handles Firebase errors with appropriate messages
 * @param {Error} error - Firebase error
 * @param {string} elementId - ID of element to show error in
 */
function handleFirebaseError(error, elementId) {
    console.error("Firebase error:", error);
    
    let message;
    switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            message = 'Invalid email or password';
            break;
        case 'auth/email-already-in-use':
            message = 'This email address is already in use';
            break;
        case 'auth/weak-password':
            message = 'Password should be at least 6 characters';
            break;
        case 'auth/network-request-failed':
            message = 'Network error. Please check your connection';
            break;
        case 'auth/requires-recent-login':
            message = 'Please log out and log in again to perform this action';
            break;
        default:
            message = error.message || 'An error occurred';
    }
    
    showError(elementId, message);
}

// Log that shared.js has loaded
console.log("Shared.js loaded successfully");