/**
 * Utility functions for calculating series progress
 * Shared between SeriesSeasons component and Profile page
 */

/**
 * Calculate overall series progress
 * @param {Object} progress - Progress data from API
 * @param {Array} seasons - Seasons array from series info (TMDB)
 * @param {Object} seasonDetails - Fetched season details (optional, for more accurate counts)
 * @returns {Object} { watched, total, percentage }
 */
export const calculateSeriesProgress = (progress, seasons, seasonDetails = {}) => {
    let totalEpisodes = 0;
    let watchedEpisodes = 0;
    
    // Only count regular seasons (exclude specials)
    const regularSeasons = seasons?.filter(season => season.season_number > 0) || [];
    
    regularSeasons.forEach(season => {
        const seasonNumber = season.season_number;
        const watchedEpisodesList = progress?.seasons?.[seasonNumber]?.episodes || [];
        
        // Try to get accurate episode count from season details first
        if (seasonDetails[seasonNumber] && seasonDetails[seasonNumber].episodes) {
            // Use actual episode count from fetched season data (includes all episodes, released + unreleased)
            totalEpisodes += seasonDetails[seasonNumber].episodes.length;
        } else if (season.episode_count) {
            // Fallback to episode_count from series info
            totalEpisodes += season.episode_count;
        }
        
        // Count watched episodes (only those in database)
        watchedEpisodes += watchedEpisodesList.length;
    });
    
    const percentage = totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;
    
    return { watched: watchedEpisodes, total: totalEpisodes, percentage };
};

/**
 * Calculate season progress
 * @param {number} seasonNumber - Season number
 * @param {Object} progress - Progress data from API
 * @param {Object} seasonData - Season data (from seasonDetails or seasons array)
 * @param {Array} seasons - Seasons array from series info (fallback)
 * @returns {Object} { watched, total, percentage }
 */
export const calculateSeasonProgress = (seasonNumber, progress, seasonData, seasons = []) => {
    const watchedEpisodes = progress?.seasons?.[seasonNumber]?.episodes || [];
    
    // If we have detailed episode data, use that (most accurate)
    if (seasonData?.episodes && seasonData.episodes.length > 0) {
        const total = seasonData.episodes.length; // All episodes (released + unreleased)
        const watched = watchedEpisodes.length;
        return { 
            watched, 
            total, 
            percentage: total > 0 ? Math.round((watched / total) * 100) : 0 
        };
    }
    
    // Fallback: use episode_count from season data or series info
    const episodeCount = seasonData?.episode_count || 
                        seasons.find(s => s.season_number === seasonNumber)?.episode_count || 0;
    
    return { 
        watched: watchedEpisodes.length, 
        total: episodeCount,
        percentage: episodeCount > 0 ? Math.round((watchedEpisodes.length / episodeCount) * 100) : 0
    };
};

