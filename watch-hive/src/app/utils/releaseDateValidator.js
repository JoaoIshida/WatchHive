/**
 * Check if a date is in the future (not yet released)
 */
export function isUnreleased(dateString) {
    if (!dateString) return false; // If no date, assume it's released
    
    try {
        const releaseDate = new Date(dateString);
        releaseDate.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return releaseDate > today;
    } catch (error) {
        return false; // If date parsing fails, assume it's released
    }
}

/**
 * Check if a movie is released
 */
export function isMovieReleased(movie) {
    if (!movie) return false;
    return !isUnreleased(movie.release_date);
}

/**
 * Check if a series is released
 */
export function isSeriesReleased(series) {
    if (!series) return false;
    return !isUnreleased(series.first_air_date);
}

/**
 * Check if a season is released
 */
export function isSeasonReleased(season) {
    if (!season) return false;
    return !isUnreleased(season.air_date);
}

/**
 * Check if an episode is released
 */
export function isEpisodeReleased(episode) {
    if (!episode) return false;
    return !isUnreleased(episode.air_date);
}

