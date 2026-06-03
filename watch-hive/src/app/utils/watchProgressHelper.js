import { isSeriesReleased } from './releaseDateValidator';
import { buildSeriesTvReleaseMeta, calculateSeriesProgress } from './seriesProgressCalculator';

/** Same rule as released-gap-count API: % from marked vs released (regular seasons). */
export function seriesPercentFromReleasedCounts(watched, releasedGap) {
    const gap = typeof releasedGap === 'number' ? Math.max(0, releasedGap) : 0;
    const marked = typeof watched === 'number' ? Math.max(0, watched) : 0;
    const total = marked + gap;
    if (total <= 0) {
        return { watched: marked, total: 0, percentage: 0 };
    }
    return {
        watched: marked,
        total,
        percentage: Math.min(100, Math.round((marked / total) * 100)),
    };
}

/** Merge cached per-season episode lists (regular seasons only). */
export function buildSeasonDetailsMap(seriesData, seasonDetailsFromContext = null) {
    const seasonDetails = {};
    if (seasonDetailsFromContext && typeof seasonDetailsFromContext === 'object') {
        for (const [key, detail] of Object.entries(seasonDetailsFromContext)) {
            const sn = Number(key);
            if (!Number.isFinite(sn) || sn <= 0) continue;
            if (detail?.episodes?.length) {
                seasonDetails[sn] = detail;
            }
        }
    }
    if (seriesData?.seasons) {
        seriesData.seasons.forEach((season) => {
            if (
                season.season_number > 0 &&
                Array.isArray(season.episodes) &&
                season.episodes.length > 0
            ) {
                seasonDetails[season.season_number] = season;
            }
        });
    }
    return seasonDetails;
}

/**
 * Series-level %: released regular episodes watched / released regular total (specials excluded).
 */
export function getSeriesWatchProgress(
    seriesId,
    seriesData = null,
    progress = null,
    isWatched = false,
    options = {},
) {
    const { seasonDetailsFromContext = null, tvmazeBySeason = null } = options;
    const seasonDetails = buildSeasonDetailsMap(seriesData, seasonDetailsFromContext);
    const seriesTvMeta = buildSeriesTvReleaseMeta(seriesData);

    const progressData = calculateSeriesProgress(
        progress,
        seriesData?.seasons || [],
        seasonDetails,
        seriesTvMeta,
        tvmazeBySeason,
    );
    const watchedEpisodes = progressData.watched;
    const totalEpisodes = progressData.total;
    const percentage = progressData.percentage;

    const seriesIsReleased =
        seriesData && seriesData.first_air_date ? isSeriesReleased(seriesData) : true;

    const episodeComplete = seriesIsReleased && totalEpisodes > 0 && percentage === 100;

    const isSeriesWatched =
        seriesIsReleased &&
        (episodeComplete || isWatched || (watchedEpisodes > 0 && percentage > 0));

    return {
        isWatched: isSeriesWatched,
        percentage,
        watchedEpisodes,
        totalEpisodes,
        isCompleted: episodeComplete,
    };
}

export function getMovieWatchStatus(movieId, watchedItem = null) {
    return {
        isWatched: !!watchedItem,
        timesWatched: watchedItem?.times_watched || 0,
    };
}
