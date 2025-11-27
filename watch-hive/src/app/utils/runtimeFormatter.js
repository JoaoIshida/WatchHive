/**
 * Format movie runtime in minutes to human-readable format
 * @param {number} runtime - Runtime in minutes
 * @returns {string} Formatted runtime (e.g., "2h 15m" or "45m")
 */
export function formatRuntime(runtime) {
    if (!runtime || runtime === 0) return null;
    
    const hours = Math.floor(runtime / 60);
    const minutes = runtime % 60;
    
    if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h`;
    } else {
        return `${minutes}m`;
    }
}

/**
 * Get series information string
 * @param {object} series - Series data object
 * @returns {string} Formatted series info (e.g., "3 Seasons" or "Miniseries • 8 Episodes")
 */
export function getSeriesInfo(series) {
    if (!series) return null;
    
    const seasons = series.number_of_seasons || 0;
    const episodes = series.number_of_episodes || 0;
    
    // Check if it's a miniseries (typically 1 season with limited episodes)
    const isMiniseries = seasons === 1 && episodes > 0 && episodes <= 10;
    
    if (isMiniseries) {
        return `Miniseries • ${episodes} ${episodes === 1 ? 'Episode' : 'Episodes'}`;
    } else if (seasons > 0 && episodes > 0) {
        return `${seasons} ${seasons === 1 ? 'Season' : 'Seasons'} • ${episodes} ${episodes === 1 ? 'Episode' : 'Episodes'}`;
    } else if (seasons > 0) {
        return `${seasons} ${seasons === 1 ? 'Season' : 'Seasons'}`;
    } else if (episodes > 0) {
        return `${episodes} ${episodes === 1 ? 'Episode' : 'Episodes'}`;
    }
    
    return null;
}

