/**
 * Format date string to readable format (e.g., "November 11, 2025")
 */
export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString; // Return original if invalid
        }
        
        return date.toLocaleDateString('en-CA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return dateString; // Return original on error
    }
}

/**
 * Format an ISO datetime (e.g. TVMaze airstamp) in the user's locale.
 */
export function formatDateTime(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        if (Number.isNaN(d.getTime())) return isoString;
        return d.toLocaleString('en-CA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return isoString;
    }
}

/**
 * Format an ISO instant in a specific IANA timezone (e.g. notification preferences timezone).
 */
export function formatDateTimeInTimeZone(isoString, ianaTimeZone) {
    if (!isoString || !ianaTimeZone) return '';
    try {
        const d = new Date(isoString);
        if (Number.isNaN(d.getTime())) return '';
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: ianaTimeZone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(d);
    } catch {
        return '';
    }
}

