import { isSeriesReleased, isSeasonReleased, isEpisodeReleased } from './releaseDateValidator';

/**
 * Get watch progress for a series
 * Returns { isWatched, percentage, watchedEpisodes, totalEpisodes }
 * Note: This function now requires progress data to be passed in since it's fetched from API
 * Total episodes includes ALL episodes (released + unreleased)
 * Watched episodes only includes released episodes that are marked as watched
 */
export function getSeriesWatchProgress(seriesId, seriesData = null, progress = null, isWatched = false) {
    
    // Calculate from episode progress
    let watchedEpisodes = 0;
    let totalEpisodes = 0;
    
    // Count watched episodes from progress (only released episodes can be watched)
    if (progress && progress.seasons) {
        Object.entries(progress.seasons).forEach(([seasonNum, seasonProgress]) => {
            const seasonNumInt = parseInt(seasonNum);
            const season = seriesData?.seasons?.find(s => s.season_number === seasonNumInt);
            
            // Only count episodes from released seasons
            const seasonIsReleased = season ? isSeasonReleased(season) : true; // Default to true if we can't check
            
            if (!seasonIsReleased) {
                return; // Skip unreleased seasons
            }
            
            if (seasonProgress.completed) {
                // If season is completed, count all episodes in that season as watched
                // But we need to know the total episodes in the season
                if (season && season.episode_count) {
                    watchedEpisodes += season.episode_count;
                } else if (seasonProgress.episodes && Array.isArray(seasonProgress.episodes)) {
                    // Fallback: use the episodes array length
                    // Note: Backend already filters unreleased episodes, so these should all be released
                    watchedEpisodes += seasonProgress.episodes.length;
                }
            } else if (seasonProgress.episodes && Array.isArray(seasonProgress.episodes)) {
                // Count individual watched episodes
                // Note: Backend already filters unreleased episodes before saving, so these should all be released
                watchedEpisodes += seasonProgress.episodes.length;
            }
        });
    }
    
    // Count total episodes (ALL episodes including unreleased)
    if (seriesData && seriesData.seasons && Array.isArray(seriesData.seasons)) {
        seriesData.seasons.forEach(season => {
            if (season.episode_count && season.episode_count > 0) {
                totalEpisodes += season.episode_count;
            }
        });
    }
    
    // Calculate percentage: (watched released episodes / total all episodes) * 100
    const percentage = totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;
    
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

