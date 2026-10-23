import { fetchTMDB } from '../api/utils';
import {
    buildSeriesTvReleaseMeta,
    isEpisodeReleasedOrdered,
    isSeasonReleased,
} from '../utils/releaseDateValidator';
import { seriesPercentFromCounts } from '../utils/seriesProgressCalculator';
import { getTvmazeEpisodeScheduleMap } from './tvmazeEpisodeSchedule';
import { resolveTvmazeShowIdFromTmdb } from './tvmazeResolveShow';

/** A stored released total younger than this is used as-is (no TMDB / TVMaze calls). */
const RELEASED_TOTAL_TTL_MS = 6 * 60 * 60 * 1000;
/** Shared Next data cache for the recompute walk, so a stale total costs mostly cache hits. */
const FETCH_CACHE = { next: { revalidate: 3600 } };
/**
 * Series recomputed at once. Each one fetches every season from TMDB and TVMaze in parallel;
 * TVMaze resets connections past ~20 concurrent requests, and a failed schedule silently falls
 * back to TMDB-only dates.
 */
const RECOMPUTE_CONCURRENCY = 2;
const SEASON_CONCURRENCY = 4;

/**
 * Released regular-season episodes for a series: same per-episode rule (TMDB + TV Maze air
 * times) the series page uses to decide what can be marked watched.
 * @param {string} seriesIdStr
 * @returns {Promise<number>}
 */
export async function computeReleasedTotal(seriesIdStr) {
    const seriesData = await fetchTMDB(`/tv/${seriesIdStr}`, { language: 'en-CA' }, FETCH_CACHE);
    const seriesTvMeta = buildSeriesTvReleaseMeta(seriesData);
    const seasons = (seriesData?.seasons || []).filter(
        (s) => s.season_number > 0 && isSeasonReleased(s),
    );

    let mazeShowId = null;
    try {
        mazeShowId = await resolveTvmazeShowIdFromTmdb(seriesIdStr, FETCH_CACHE);
    } catch {
        mazeShowId = null;
    }

    const countSeason = async ({ season_number: sn }) => {
        const [seasonData, mazeMap] = await Promise.all([
            fetchTMDB(`/tv/${seriesIdStr}/season/${sn}`, { language: 'en-CA' }, FETCH_CACHE),
            getTvmazeEpisodeScheduleMap(seriesIdStr, sn, { mazeShowId, cache: FETCH_CACHE }),
        ]);
        return (seasonData?.episodes || []).filter((ep) =>
            isEpisodeReleasedOrdered(ep, seasonData, mazeMap, seriesTvMeta),
        ).length;
    };
    // Seasons in small batches too (each costs 2 TVMaze requests); see RECOMPUTE_CONCURRENCY.
    let total = 0;
    for (let i = 0; i < seasons.length; i += SEASON_CONCURRENCY) {
        const counts = await Promise.all(seasons.slice(i, i + SEASON_CONCURRENCY).map(countSeason));
        total += counts.reduce((a, b) => a + b, 0);
    }
    return total;
}

/**
 * % watched for the user's series.
 * Watched counts come from SQL (series_watch_counts): loading every episode row through the API
 * capped at 1000 rows and silently dropped half of large histories. The released total is
 * stored on series_progress and recomputed when older than the TTL (new airings); marking
 * episodes changes the SQL count, not the total.
 *
 * Series with no stored total are computed before responding. With `defer` (Next's `after`),
 * stale ones answer from the stored total and refresh after the response; a full cold
 * recompute of a large list takes tens of seconds.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase service-role client
 * @param {string} userId
 * @param {string[]} seriesIds
 * @param {{ defer?: (task: () => Promise<void>) => void }} [options]
 * @returns {Promise<Record<string, { count: number, watched: number, releasedTotal: number } | { error: true }>>}
 */
export async function computeReleasedGapBatch(supabase, userId, seriesIds, { defer } = {}) {
    const uniqueIds = [...new Set(seriesIds.map((id) => String(id)).filter(Boolean))];
    if (uniqueIds.length === 0) return {};

    const { data: rows, error } = await supabase.rpc('series_watch_counts', { p_user_id: userId });
    if (error) throw error;
    const byId = new Map((rows || []).map((r) => [String(r.series_id), r]));

    const now = Date.now();
    const totals = new Map();
    const missing = [];
    const stale = [];
    for (const id of uniqueIds) {
        const row = byId.get(id);
        const stored = row?.released_total ?? null;
        if (stored != null) totals.set(id, stored);
        const fresh =
            stored != null &&
            row?.released_checked_at &&
            now - new Date(row.released_checked_at).getTime() < RELEASED_TOTAL_TTL_MS;
        if (stored == null) missing.push(id);
        else if (!fresh) stale.push(id);
    }

    // A few series at a time: each walks every season on TMDB + TVMaze.
    const recompute = async (ids) => {
        for (let i = 0; i < ids.length; i += RECOMPUTE_CONCURRENCY) {
            await Promise.all(
                ids.slice(i, i + RECOMPUTE_CONCURRENCY).map(async (id) => {
                    try {
                        const total = await computeReleasedTotal(id);
                        totals.set(id, total);
                        if (!byId.has(id)) return;
                        const { error: upErr } = await supabase
                            .from('series_progress')
                            .update({
                                released_total_episodes: total,
                                released_total_checked_at: new Date().toISOString(),
                            })
                            .eq('user_id', userId)
                            .eq('series_id', Number(id));
                        if (upErr) console.error(`store released total ${id}:`, upErr);
                    } catch (err) {
                        // Keeps the last stored total (if any) rather than showing nothing / 0%.
                        console.error(`released total failed for ${id}:`, err);
                    }
                }),
            );
        }
    };

    if (defer) {
        await recompute(missing);
        if (stale.length) defer(() => recompute(stale));
    } else {
        await recompute([...missing, ...stale]);
    }

    return Object.fromEntries(
        uniqueIds.map((id) => {
            if (!totals.has(id)) return [id, { error: true }];
            const { watched, total } = seriesPercentFromCounts(byId.get(id)?.watched ?? 0, totals.get(id));
            return [id, { count: Math.max(0, total - watched), watched, releasedTotal: total }];
        }),
    );
}
