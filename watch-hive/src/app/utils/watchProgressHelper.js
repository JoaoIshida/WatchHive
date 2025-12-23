import { isSeriesReleased, isSeasonReleased, isEpisodeReleased } from './releaseDateValidator';
import { calculateSeriesProgress } from './seriesProgressCalculator';

/**
 * Get watch progress for a series
 * Returns { isWatched, percentage, watchedEpisodes, totalEpisodes }
 * Note: This function now requires progress data to be passed in since it's fetched from API
 * Total episodes includes ALL episodes (released + unreleased)
 * Watched episodes only includes released episodes that are marked as watched
 * Uses shared utility for consistent calculation with SeriesSeasons and Profile page
 */
export function getSeriesWatchProgress(seriesId, seriesData = null, progress = null, isWatched = false) {
    
    // Use shared utility for consistent calculation
    // Build seasonDetails object from seriesData if it has episode data
    // Exclude specials (season_number === 0) from percentage calculation
    const seasonDetails = {};
    if (seriesData && seriesData.seasons) {
        seriesData.seasons.forEach(season => {
            // Only include regular seasons (exclude specials)
            if (season.season_number > 0 && season.episodes && Array.isArray(season.episodes) && season.episodes.length > 0) {
                seasonDetails[season.season_number] = season;
            }
        });
    }
    
    // Use shared utility to calculate progress (same logic as SeriesSeasons and Profile)
    const progressData = calculateSeriesProgress(progress, seriesData?.seasons || [], seasonDetails);
    const watchedEpisodes = progressData.watched;
    const totalEpisodes = progressData.total;
    const percentage = progressData.percentage;
    
    // Check if series is released
    const seriesIsReleased = seriesData && seriesData.first_air_date 
        ? isSeriesReleased(seriesData) 
        : true; // Default to true if we can't check (assume released)
    
    // Series is considered watched ONLY if:
    // 1. It's explicitly marked as watched in watched_content (user's explicit choice), OR
    // 2. It's marked as completed in progress AND series is released, OR
    // 3. It has watched episodes AND series is released
    // This prevents unreleased series from showing as watched, even if Supabase has it marked
    const isSeriesWatched = isWatched || 
                           (progress && progress.completed && seriesIsReleased) || 
                           (watchedEpisodes > 0 && seriesIsReleased);
    
    return {
        isWatched: isSeriesWatched,
        percentage,
        watchedEpisodes,
        totalEpisodes,
        isCompleted: progress?.completed || false
    };
}

/**
 * Get watch status for a movie
 * Note: This function now requires watched data to be passed in since it's fetched from API
 */
export function getMovieWatchStatus(movieId, watchedItem = null) {
    return {
        isWatched: !!watchedItem,
        timesWatched: watchedItem?.times_watched || 0
    };
}

