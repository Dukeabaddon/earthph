/**
 * Date formatting utilities
 * Following frontend-developer.md standards for internationalization
 */

/**
 * Format ISO datetime to human-readable string
 * 
 * @param {string} isoString - ISO 8601 datetime string
 * @returns {Object} { date: string, time: string, combined: string }
 */
export function formatDateTime(isoString) {
  try {
    const date = new Date(isoString);
    
    const dateStr = new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Manila'
    }).format(date);
    
    const timeStr = new Intl.DateTimeFormat('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
      hour12: true
    }).format(date);
    
    const combinedStr = new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
      hour12: true
    }).format(date);
    
    return { date: dateStr, time: timeStr, combined: combinedStr };
  } catch (err) {
    console.error('[DateFormat] Error:', err);
    return { date: 'Invalid date', time: '', combined: 'Invalid date' };
  }
}

/**
 * Calculate time ago from now
 * 
 * @param {string} isoString - ISO 8601 datetime string
 * @returns {string} Relative time string (e.g., "2 hours ago")
 */
export function timeAgo(isoString) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return formatDateTime(isoString);
  } catch (err) {
    console.error('[TimeAgo] Error:', err);
    return 'Unknown';
  }
}

/**
 * Format magnitude with color coding
 * 
 * @param {number} magnitude - Earthquake magnitude
 * @returns {Object} { value: string, colorClass: string, bgClass: string }
 */
export function formatMagnitude(magnitude) {
  const mag = parseFloat(magnitude);
  
  if (isNaN(mag)) {
    return { 
      value: 'N/A', 
      colorClass: 'text-gray-500',
      bgClass: 'bg-gray-100'
    };
  }

  let colorClass, bgClass;
  if (mag >= 7.0) {
    colorClass = 'text-danger-700 font-bold';
    bgClass = 'bg-danger-100';
  } else if (mag >= 6.0) {
    colorClass = 'text-danger-600 font-semibold';
    bgClass = 'bg-danger-50';
  } else if (mag >= 5.0) {
    colorClass = 'text-warning-600 font-semibold';
    bgClass = 'bg-warning-100';
  } else if (mag >= 4.0) {
    colorClass = 'text-warning-500';
    bgClass = 'bg-warning-50';
  } else {
    colorClass = 'text-primary-600';
    bgClass = 'bg-primary-50';
  }

  return { value: mag.toFixed(1), colorClass, bgClass };
}

/**
 * Format depth with units
 * 
 * @param {number} depth - Depth in kilometers
 * @returns {string} Formatted depth string
 */
export function formatDepth(depth) {
  if (depth === null || depth === undefined || isNaN(depth)) {
    return 'N/A';
  }
  return `${parseFloat(depth).toFixed(1)} km`;
}
