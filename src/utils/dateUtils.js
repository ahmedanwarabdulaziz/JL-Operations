/**
 * Centralized date utility functions for handling Firestore Timestamps
 * This prevents "Objects are not valid as a React child" errors
 */

/**
 * Safely formats any date value (Firestore Timestamp, Date object, string, or number)
 * @param {any} dateValue - The date value to format
 * @param {Object} options - Formatting options (optional)
 * @returns {string} - Formatted date string or fallback value
 */
export const formatDate = (dateValue, options = {}) => {
  try {
    if (!dateValue) {
      return options.fallback || 'N/A';
    }

    let dateObj;

    // Handle Firestore Timestamp objects
    if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
      dateObj = dateValue.toDate();
    }
    // Handle Firestore Timestamp objects with seconds/nanoseconds
    else if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
      dateObj = new Date(dateValue.seconds * 1000);
    }
    // Handle date-only strings (YYYY-MM-DD format) - parse in local timezone
    else if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      // Parse YYYY-MM-DD format as local date (not UTC)
      const [year, month, day] = dateValue.split('-').map(Number);
      dateObj = new Date(year, month - 1, day); // month is 0-indexed
    }
    // Handle regular Date objects or other date strings/numbers
    else {
      dateObj = new Date(dateValue);
    }

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return options.fallback || 'Invalid Date';
    }

    // Default formatting options
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    };

    return dateObj.toLocaleDateString('en-US', defaultOptions);
  } catch (error) {
    console.error('Error formatting date:', error, 'Date value:', dateValue);
    return options.fallback || 'Error';
  }
};

/**
 * Formats date for display in tables (date only)
 * @param {any} dateValue - The date value to format
 * @returns {string} - Formatted date string
 */
export const formatDateOnly = (dateValue) => {
  try {
    if (!dateValue) {
      return 'N/A';
    }

    let dateObj;

    // Handle Firestore Timestamp objects
    if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
      dateObj = dateValue.toDate();
    }
    // Handle Firestore Timestamp objects with seconds/nanoseconds
    else if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
      dateObj = new Date(dateValue.seconds * 1000);
    }
    // Handle date-only strings (YYYY-MM-DD format) - parse in local timezone
    else if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      // Parse YYYY-MM-DD format as local date (not UTC)
      const [year, month, day] = dateValue.split('-').map(Number);
      dateObj = new Date(year, month - 1, day); // month is 0-indexed
    }
    // Handle regular Date objects or other date strings/numbers
    else {
      dateObj = new Date(dateValue);
    }

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    // Format as date only (no time)
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date only:', error, 'Date value:', dateValue);
    return 'Error';
  }
};

/**
 * Formats date for display in tables (date and time)
 * @param {any} dateValue - The date value to format
 * @returns {string} - Formatted date and time string
 */
export const formatDateTime = (dateValue) => {
  return formatDate(dateValue, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    fallback: 'N/A'
  });
};

/**
 * Formats date for display in tables (time only)
 * @param {any} dateValue - The date value to format
 * @returns {string} - Formatted time string
 */
export const formatTimeOnly = (dateValue) => {
  return formatDate(dateValue, {
    hour: '2-digit',
    minute: '2-digit',
    fallback: 'N/A'
  });
};

/**
 * Formats date range for display
 * @param {any} startDate - The start date value
 * @param {any} endDate - The end date value
 * @returns {string} - Formatted date range string
 */
export const formatDateRange = (startDate, endDate) => {
  try {
    const start = formatDateOnly(startDate);
    const end = formatDateOnly(endDate);
    
    if (start === 'N/A' && end === 'N/A') {
      return 'No dates set';
    }
    
    if (start === 'N/A') {
      return `Until ${end}`;
    }
    
    if (end === 'N/A') {
      return `From ${start}`;
    }
    
    return `${start} - ${end}`;
  } catch (error) {
    console.error('Error formatting date range:', error);
    return 'Invalid Date Range';
  }
};

/**
 * Safely converts any date value to a Date object
 * @param {any} dateValue - The date value to convert
 * @returns {Date|null} - Date object or null if invalid
 */
export const toDateObject = (dateValue) => {
  try {
    if (!dateValue) {
      return null;
    }

    // Handle Firestore Timestamp objects
    if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
      return dateValue.toDate();
    }
    // Handle Firestore Timestamp objects with seconds/nanoseconds
    else if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
      return new Date(dateValue.seconds * 1000);
    }
    // Handle date-only strings (YYYY-MM-DD format) - parse in local timezone
    else if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      // Parse YYYY-MM-DD format as local date (not UTC)
      const [year, month, day] = dateValue.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day); // month is 0-indexed
      return isNaN(dateObj.getTime()) ? null : dateObj;
    }
    // Handle regular Date objects or other date strings/numbers
    else {
      const dateObj = new Date(dateValue);
      return isNaN(dateObj.getTime()) ? null : dateObj;
    }
  } catch (error) {
    console.error('Error converting to date object:', error);
    return null;
  }
};

/**
 * Checks if a date value is a Firestore Timestamp
 * @param {any} dateValue - The date value to check
 * @returns {boolean} - True if it's a Firestore Timestamp
 */
export const isFirestoreTimestamp = (dateValue) => {
  return dateValue && 
         typeof dateValue === 'object' && 
         (dateValue.toDate || dateValue.seconds);
};

/**
 * Gets the current date as a formatted string
 * @returns {string} - Current date formatted string
 */
export const getCurrentDate = () => {
  return formatDateOnly(new Date());
};

/**
 * Gets the current date and time as a formatted string
 * @returns {string} - Current date and time formatted string
 */
export const getCurrentDateTime = () => {
  return formatDateTime(new Date());
};
