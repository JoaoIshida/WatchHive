/**
 * Utility functions for calculating series progress
 * Shared between SeriesSeasons component and Profile page
 *
 * Specials (TMDB season_number === 0) are never included in series-level progress.
 * Series-level % = released regular episodes watched / released regular episodes total
 * (same rule as calculateSeasonProgress, aggregated per season).
 */

import {
    buildSeriesTvReleaseMeta,
    isEpisodeReleased,
    isEpisodeReleasedOrdered,
    isSeasonReleased,
} from './releaseDateValidator.js';

export { buildSeriesTvReleaseMeta };

/** @param {number} seasonNumber */
export const isRegularSeason = (seasonNumber) => Number(seasonNumber) > 0;

function seasonProgressEntry(progress, seasonNumber) {
    const map = progress?.seasons || {};
    return map[seasonNumber] ?? map[String(seasonNumber)] ?? null;
}

/** Released episode count for a season when we only have TMDB season summary (no episode list). */
function seasonReleasedCountWithoutEpisodeList(seasonNumber, seriesTvMeta, episodeCountFallback = 0) {
    const sn = Number(seasonNumber);
    const last = seriesTvMeta?.last_episode_to_air;
    const next = seriesTvMeta?.next_episode_to_air;
    const lastSn = last != null ? Number(last.season_number) : null;
    const lastEp = last != null ? Number(last.episode_number) : null;
    const nextSn = next != null ? Number(next.season_number) : null;

    if (lastSn === sn && typeof lastEp === 'number' && lastEp > 0) {
        return lastEp;
    }

    if (lastSn != null && lastSn < sn) {
        if (nextSn != null && nextSn >= sn) {
            return 0;
        }
    }

    if (lastSn != null && lastSn > sn) {
        return episodeCountFallback > 0 ? episodeCountFallback : 0;
    }

    if (nextSn === sn && next != null && typeof next.episode_number === 'number' && next.episode_number > 1) {
        return next.episode_number - 1;
    }

    return 0;
}

function releasedTotalsForSeasonSummary(season, progress, seriesTvMeta) {
    if (!isSeasonReleased(season)) {
        return { watched: 0, total: 0 };
    }

    const seasonNumber = season.season_number;
    const entry = seasonProgressEntry(progress, seasonNumber);
    const watchedList = entry?.episodes || [];
    const episodeCount =
        typeof season.episode_count === 'number' && season.episode_count > 0
            ? season.episode_count
            : 0;

    const releasedTotal = seasonReleasedCountWithoutEpisodeList(
        seasonNumber,
        seriesTvMeta,
        episodeCount,
    );

    if (releasedTotal <= 0 && watchedList.length === 0) {
        return { watched: 0, total: 0 };
    }

    const total =
        watchedList.length > 0 ? Math.max(releasedTotal, watchedList.length) : releasedTotal;
    const watched = watchedList.length;

    return { watched, total };
}

/**
 * Series-level progress (released regular episodes only; specials excluded).
 */
export const calculateSeriesProgress = (
    progress,
    seasons,
    seasonDetails = {},
    seriesTvMeta = null,
    tvmazeBySeason = null,
) => {
    const regularFromTmdb = seasons?.filter((s) => isRegularSeason(s.season_number)) || [];
    const seasonNumbers = new Set(regularFromTmdb.map((s) => s.season_number));

    for (const key of Object.keys(progress?.seasons || {})) {
        const sn = Number(key);
        if (isRegularSeason(sn)) seasonNumbers.add(sn);
    }

    let watchedEpisodes = 0;
    let totalEpisodes = 0;

    for (const seasonNumber of seasonNumbers) {
        const season =
            regularFromTmdb.find((s) => s.season_number === seasonNumber) ||
            seasons?.find((s) => s.season_number === seasonNumber);
        const detail = seasonDetails[seasonNumber] ?? seasonDetails[String(seasonNumber)];
        const scheduleMap =
            tvmazeBySeason?.[seasonNumber] ?? tvmazeBySeason?.[String(seasonNumber)] ?? null;
        const seasonData = detail?.episodes?.length ? detail : season;

        if (seasonData?.episodes?.length) {
            const part = calculateSeasonProgress(
                seasonNumber,
                progress,
                seasonData,
                seasons,
                seriesTvMeta,
                scheduleMap,
            );
            watchedEpisodes += part.watched;
            totalEpisodes += part.total;
            continue;
        }

        if (season) {
            const part = releasedTotalsForSeasonSummary(season, progress, seriesTvMeta);
            watchedEpisodes += part.watched;
            totalEpisodes += part.total;
        }
    }

    const percentage =
        totalEpisodes > 0
            ? Math.min(100, Math.round((watchedEpisodes / totalEpisodes) * 100))
            : 0;

    return { watched: watchedEpisodes, total: totalEpisodes, percentage };
};

export const isSeriesCompletedByEpisodes = (
    progress,
    seasons,
    seasonDetails = {},
    seriesTvMeta = null,
    tvmazeBySeason = null,
) => {
    const { total, percentage } = calculateSeriesProgress(
        progress,
        seasons,
        seasonDetails,
        seriesTvMeta,
        tvmazeBySeason,
    );
    return total > 0 && percentage === 100;
};

export const calculateSeasonProgress = (
    seasonNumber,
    progress,
    seasonData,
    seasons = [],
    seriesTvMeta = null,
    scheduleMap = null,
) => {
    const watchedEpisodes =
        progress?.seasons?.[seasonNumber]?.episodes ||
        progress?.seasons?.[String(seasonNumber)]?.episodes ||
        [];

    if (seasonData?.episodes && seasonData.episodes.length > 0) {
        const released = scheduleMap
            ? seasonData.episodes.filter((ep) =>
                  isEpisodeReleasedOrdered(ep, seasonData, scheduleMap, seriesTvMeta),
              )
            : seasonData.episodes.filter((ep) =>
                  isEpisodeReleased(ep, seasonData, null, seriesTvMeta),
              );
        const total = released.length;
        const watched = watchedEpisodes.filter((epNum) =>
            released.some((ep) => ep.episode_number === epNum),
        ).length;
        return {
            watched,
            total,
            percentage: total > 0 ? Math.round((watched / total) * 100) : 0,
        };
    }

    const seasonSummary =
        seasons.find((s) => s.season_number === seasonNumber) ||
        (seasonData?.season_number === seasonNumber ? seasonData : null);

    if (seasonSummary) {
        return releasedTotalsForSeasonSummary(seasonSummary, progress, seriesTvMeta);
    }

    const episodeCount = seasonData?.episode_count || 0;
    return {
        watched: watchedEpisodes.length,
        total: episodeCount,
        percentage:
            episodeCount > 0 ? Math.round((watchedEpisodes.length / episodeCount) * 100) : 0,
    };
};
