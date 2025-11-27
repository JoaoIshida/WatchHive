import { watchedStorage, seriesProgressStorage } from '../lib/localStorage';

/**
 * Get watch progress for a series
 * Returns { isWatched, percentage, watchedEpisodes, totalEpisodes }
 */
export function getSeriesWatchProgress(seriesId, seriesData = null) {
    const isWatched = watchedStorage.isWatched(String(seriesId), 'tv');
    const progress = seriesProgressStorage.getSeriesProgress(String(seriesId));
    
    // If series is marked as completed, it's 100%
    if (progress.completed || isWatched) {
        return {
            isWatched: true,
            percentage: 100,
            watchedEpisodes: null,
            totalEpisodes: null,
            isCompleted: true
        };
    }
    
    // Calculate from episode progress
    let watchedEpisodes = 0;
    let totalEpisodes = 0;
    let hasAccurateData = false;
    
    if (seriesData && seriesData.seasons && Array.isArray(seriesData.seasons)) {
        // Use actual season data if available
        seriesData.seasons.forEach(season => {
            if (season.episode_count && season.episode_count > 0) {
                totalEpisodes += season.episode_count;
                hasAccurateData = true;
                const seasonProgress = progress.seasons[season.season_number];
                if (seasonProgress?.completed) {
                    watchedEpisodes += season.episode_count;
                } else if (seasonProgress?.episodes && Array.isArray(seasonProgress.episodes)) {
                    watchedEpisodes += seasonProgress.episodes.length;
                }
            }
        });
    }
    
    // If we don't have accurate data, try to estimate from progress
    if (!hasAccurateData && Object.keys(progress.seasons || {}).length > 0) {
        // Count watched episodes from progress
        Object.entries(progress.seasons || {}).forEach(([seasonNum, season]) => {
            if (season.completed) {
                // Season is completed but we don't know episode count
                // Don't include in calculation to avoid inaccurate percentage
            } else if (season.episodes && Array.isArray(season.episodes) && season.episodes.length > 0) {
                watchedEpisodes += season.episodes.length;
                // Estimate total as watched + some unwatched (conservative estimate)
                totalEpisodes += season.episodes.length + Math.max(1, Math.floor(season.episodes.length * 0.3));
            }
        });
    }
    
    const percentage = totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;
    
    return {
        isWatched: isWatched || percentage > 0,
        percentage,
        watchedEpisodes,
        totalEpisodes,
        isCompleted: progress.completed || false
    };
}

/**
 * Get watch status for a movie
 */
export function getMovieWatchStatus(movieId) {
    return {
        isWatched: watchedStorage.isWatched(String(movieId), 'movie'),
        timesWatched: watchedStorage.getTimesWatched(String(movieId), 'movie')
    };
}

