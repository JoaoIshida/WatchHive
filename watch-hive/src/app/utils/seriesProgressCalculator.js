/**
 * Utility functions for calculating series progress
 * Shared between SeriesSeasons component and Profile page
 *
 * Specials (TMDB season_number === 0) are never included in series-level progress.
 */

import {
    buildSeriesTvReleaseMeta,
    isEpisodeReleased,
    isEpisodeReleasedOrdered,
    isSeasonReleased,
} from './releaseDateValidator';

/** @param {number} seasonNumber */
export const isRegularSeason = (seasonNumber) => Number(seasonNumber) > 0;

function seasonProgressEntry(progress, seasonNumber) {
    const map = progress?.seasons || {};
    return map[seasonNumber] ?? map[String(seasonNumber)] ?? null;
}

function watchedCountFromProgressSeasons(progress) {
    let watched = 0;
    const map = progress?.seasons || {};
    for (const key of Object.keys(map)) {
        const seasonNumber = Number(key);
        if (!isRegularSeason(seasonNumber)) continue;
        watched += (map[key]?.episodes || []).length;
    }
    return watched;
}

function countMarkableEpisodesInSeason(seasonData, seriesTvMeta, scheduleMap = null) {
    if (!seasonData?.episodes?.length) return 0;
    if (scheduleMap) {
        return seasonData.episodes.filter((ep) =>
            isEpisodeReleasedOrdered(ep, seasonData, scheduleMap, seriesTvMeta),
        ).length;
    }
    return seasonData.episodes.filter((ep) =>
        isEpisodeReleased(ep, seasonData, null, seriesTvMeta),
    ).length;
}

/** Every premiered regular season in TMDB has completed=true in user progress. */
export function allRegularSeasonsMarkedComplete(progress, seasons) {
    const regularSeasons =
        seasons?.filter((s) => isRegularSeason(s.season_number) && isSeasonReleased(s)) || [];
    if (regularSeasons.length === 0) return false;
    return regularSeasons.every((season) => {
        const entry = seasonProgressEntry(progress, season.season_number);
        return entry?.completed === true;
    });
}

function totalEpisodesFromRegularSeasons(
    progress,
    seasons,
    seasonDetails = {},
    seriesTvMeta = null,
    tvmazeBySeason = null,
) {
    const regularSeasons = seasons?.filter((season) => isRegularSeason(season.season_number)) || [];
    let totalEpisodes = 0;

    regularSeasons.forEach((season) => {
        const seasonNumber = season.season_number;
        const entry = seasonProgressEntry(progress, seasonNumber);
        const watchedList = entry?.episodes || [];
        const detail = seasonDetails[seasonNumber] ?? seasonDetails[String(seasonNumber)];
        const scheduleMap =
            tvmazeBySeason?.[seasonNumber] ?? tvmazeBySeason?.[String(seasonNumber)] ?? null;

        // Mark-season-complete persists released episodes only — use that as this season's total
        if (entry?.completed === true && watchedList.length > 0) {
            totalEpisodes += watchedList.length;
            return;
        }

        if (detail?.episodes?.length) {
            const markable = countMarkableEpisodesInSeason(detail, seriesTvMeta, scheduleMap);
            const cap =
                typeof season.episode_count === 'number' && season.episode_count > 0
                    ? season.episode_count
                    : markable;
            totalEpisodes += Math.min(markable, cap);
            return;
        }

        if (!isSeasonReleased(season)) {
            return;
        }

        if (typeof season.episode_count === 'number' && season.episode_count > 0) {
            totalEpisodes += season.episode_count;
        }
    });

    return totalEpisodes;
}

export const calculateSeriesProgress = (
    progress,
    seasons,
    seasonDetails = {},
    seriesTvMeta = null,
    tvmazeBySeason = null,
) => {
    const watchedEpisodes = watchedCountFromProgressSeasons(progress);
    const regularSeasons = seasons?.filter((s) => isRegularSeason(s.season_number)) || [];

    if (allRegularSeasonsMarkedComplete(progress, seasons) && watchedEpisodes > 0) {
        return {
            watched: watchedEpisodes,
            total: watchedEpisodes,
            percentage: 100,
        };
    }

    let totalEpisodes = totalEpisodesFromRegularSeasons(
        progress,
        seasons,
        seasonDetails,
        seriesTvMeta,
        tvmazeBySeason,
    );

    if (totalEpisodes === 0 && regularSeasons.length === 0) {
        const catalogTotal = progress?.catalogTotalEpisodes;
        if (typeof catalogTotal === 'number' && catalogTotal > 0) {
            totalEpisodes = catalogTotal;
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
    if (allRegularSeasonsMarkedComplete(progress, seasons) && watchedCountFromProgressSeasons(progress) > 0) {
        return true;
    }
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

    const episodeCount =
        seasonData?.episode_count ||
        seasons.find((s) => s.season_number === seasonNumber)?.episode_count ||
        0;

    return {
        watched: watchedEpisodes.length,
        total: episodeCount,
        percentage:
            episodeCount > 0 ? Math.round((watchedEpisodes.length / episodeCount) * 100) : 0,
    };
};

export { buildSeriesTvReleaseMeta };
