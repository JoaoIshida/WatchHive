/**
 * Fetch TV episode schedule snippets (airdate/airstamp) from TV Maze keyed by TMDB TV id + season.
 * Mirrors the client proxy route but safe for Route Handlers / server helpers.
 */

import {
    resolveTvmazeShowIdFromTmdb,
    tvmazeFetchUrl,
    TVMAZE_HEADERS,
} from './tvmazeResolveShow';

/**
 * Returns `Map<number, { airdate?, airstamp? }>` for that season's episodes, or `null`
 * if unmappable / network failure (caller treats as TMDB-only).
 *
 * @param {string | number} tmdbTvId
 * @param {number} seasonNumber regular season (typically >= 1)
 */
export async function getTvmazeEpisodeScheduleMap(tmdbTvId, seasonNumber) {
    try {
        const mazeShowId = await resolveTvmazeShowIdFromTmdb(String(tmdbTvId), {});
        if (!mazeShowId) return null;

        const seasonsRes = await fetch(tvmazeFetchUrl(`/shows/${mazeShowId}/seasons`), {
            headers: TVMAZE_HEADERS,
        });
        if (!seasonsRes.ok) return null;

        const seasons = await seasonsRes.json();
        const seasonMeta = Array.isArray(seasons)
            ? seasons.find((s) => s.number === seasonNumber)
            : null;

        if (!seasonMeta?.id) return null;

        const epRes = await fetch(tvmazeFetchUrl(`/seasons/${seasonMeta.id}/episodes`), {
            headers: TVMAZE_HEADERS,
        });
        if (!epRes.ok) return null;

        const raw = await epRes.json();
        const list = Array.isArray(raw) ? raw : [];

        const map = new Map();
        for (const e of list) {
            if (typeof e.number !== 'number') continue;
            map.set(e.number, {
                airdate: e.airdate ?? null,
                airstamp: e.airstamp ?? null,
            });
        }

        return map;
    } catch (e) {
        console.warn('getTvmazeEpisodeScheduleMap:', e?.message ?? e);
        return null;
    }
}
