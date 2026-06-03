import { fetchTMDB } from '../api/utils';
import {
    buildSeriesTvReleaseMeta,
    isEpisodeReleasedOrdered,
    isSeasonReleased,
} from '../utils/releaseDateValidator';
import { getTvmazeEpisodeScheduleMap } from './tvmazeEpisodeSchedule';
import { resolveTvmazeShowIdFromTmdb } from './tvmazeResolveShow';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string[]} seriesIds
 * @returns {Promise<Map<string, Map<number, Set<number>>>>}
 */
export async function loadWatchedEpisodesBySeries(supabase, userId, seriesIds) {
    const uniqueIds = [...new Set(seriesIds.map((id) => String(id)).filter(Boolean))];
    const result = new Map();
    for (const id of uniqueIds) {
        result.set(id, new Map());
    }
    if (uniqueIds.length === 0) {
        return result;
    }

    const { data: progressRows } = await supabase
        .from('series_progress')
        .select('id, series_id')
        .eq('user_id', userId)
        .in('series_id', uniqueIds);

    if (!progressRows?.length) {
        return result;
    }

    const progressIdBySeriesId = new Map();
    for (const row of progressRows) {
        progressIdBySeriesId.set(String(row.series_id), row.id);
    }

    const progressIds = progressRows.map((p) => p.id);
    const { data: seasonRows } = await supabase
        .from('series_seasons')
        .select('id, season_number, series_progress_id')
        .in('series_progress_id', progressIds);

    if (!seasonRows?.length) {
        return result;
    }

    const seasonNumberById = new Map();
    const seriesIdByProgressId = new Map();
    for (const row of progressRows) {
        seriesIdByProgressId.set(row.id, String(row.series_id));
    }
    for (const s of seasonRows) {
        seasonNumberById.set(s.id, s.season_number);
    }

    const { data: episodeRows } = await supabase
        .from('series_episodes')
        .select('episode_number, series_season_id')
        .in(
            'series_season_id',
            seasonRows.map((s) => s.id),
        );

    for (const ep of episodeRows || []) {
        const sn = seasonNumberById.get(ep.series_season_id);
        if (sn === undefined || sn <= 0) continue;
        const seasonRow = seasonRows.find((s) => s.id === ep.series_season_id);
        if (!seasonRow) continue;
        const seriesId = seriesIdByProgressId.get(seasonRow.series_progress_id);
        if (!seriesId) continue;
        let bySeason = result.get(seriesId);
        if (!bySeason) {
            bySeason = new Map();
            result.set(seriesId, bySeason);
        }
        if (!bySeason.has(sn)) bySeason.set(sn, new Set());
        bySeason.get(sn).add(ep.episode_number);
    }

    return result;
}

/**
 * @param {string} seriesIdStr
 * @param {Map<number, Set<number>>|undefined} watchedBySeason
 */
export async function computeReleasedGapForSeries(seriesIdStr, watchedBySeason = new Map()) {
    let watchedRegular = 0;
    for (const [sn, eps] of watchedBySeason) {
        if (sn > 0) watchedRegular += eps.size;
    }

    const seriesData = await fetchTMDB(`/tv/${seriesIdStr}`, { language: 'en-CA' });
    const seriesTvMeta = buildSeriesTvReleaseMeta(seriesData);
    const sorted = [...(seriesData?.seasons || [])]
        .filter((s) => s.season_number > 0 && isSeasonReleased(s))
        .sort((a, b) => a.season_number - b.season_number);

    let mazeShowId = null;
    try {
        mazeShowId = await resolveTvmazeShowIdFromTmdb(seriesIdStr, {});
    } catch {
        mazeShowId = null;
    }

    const seasonResults = await Promise.all(
        sorted.map(async (seasonInfo) => {
            const sn = seasonInfo.season_number;
            const [seasonData, mazeMap] = await Promise.all([
                fetchTMDB(`/tv/${seriesIdStr}/season/${sn}`, { language: 'en-CA' }),
                getTvmazeEpisodeScheduleMap(seriesIdStr, sn, { mazeShowId }),
            ]);
            const released = (seasonData?.episodes || []).filter((ep) =>
                isEpisodeReleasedOrdered(ep, seasonData, mazeMap, seriesTvMeta),
            );
            const watched = watchedBySeason.get(sn) || new Set();
            let seasonGap = 0;
            for (const ep of released) {
                if (!watched.has(ep.episode_number)) seasonGap++;
            }
            return { gap: seasonGap, releasedCount: released.length };
        }),
    );

    let gap = 0;
    let releasedTotal = 0;
    for (const row of seasonResults) {
        gap += row.gap;
        releasedTotal += row.releasedCount;
    }

    return {
        count: gap,
        watched: watchedRegular,
        releasedTotal,
    };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string[]} seriesIds
 */
export async function computeReleasedGapBatch(supabase, userId, seriesIds) {
    const uniqueIds = [...new Set(seriesIds.map((id) => String(id)).filter(Boolean))];
    const watchedBySeries = await loadWatchedEpisodesBySeries(supabase, userId, uniqueIds);

    const entries = await Promise.all(
        uniqueIds.map(async (seriesIdStr) => {
            try {
                const stats = await computeReleasedGapForSeries(
                    seriesIdStr,
                    watchedBySeries.get(seriesIdStr) || new Map(),
                );
                return [seriesIdStr, stats];
            } catch (err) {
                console.error(`released gap failed for ${seriesIdStr}:`, err);
                return [seriesIdStr, { error: true }];
            }
        }),
    );

    return Object.fromEntries(entries);
}
