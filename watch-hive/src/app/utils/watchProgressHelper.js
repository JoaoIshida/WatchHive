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
            if (seasonProgress.completed) {
                // If season is completed, count all episodes in that season as watched
                // But we need to know the total episodes in the season
                const seasonNumInt = parseInt(seasonNum);
                const season = seriesData?.seasons?.find(s => s.season_number === seasonNumInt);
                if (season && season.episode_count) {
                    watchedEpisodes += season.episode_count;
                } else if (seasonProgress.episodes && Array.isArray(seasonProgress.episodes)) {
                    // Fallback: use the episodes array length
                    watchedEpisodes += seasonProgress.episodes.length;
                }
            } else if (seasonProgress.episodes && Array.isArray(seasonProgress.episodes)) {
                // Count individual watched episodes
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
    
    // Series is considered watched if it's marked as watched in watched_content OR has progress
    const isSeriesWatched = isWatched || (progress && progress.completed) || watchedEpisodes > 0;
    
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

