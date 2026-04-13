import { fetchTMDB } from '../api/utils';

const TVMAZE = 'https://api.tvmaze.com';

export const TVMAZE_HEADERS = {
    Accept: 'application/json',
    'User-Agent': 'WatchHive/1.0 (https://themoviedb.org)',
};

export function tvmazeFetchUrl(path) {
    const url = new URL(`${TVMAZE}${path}`);
    const key = process.env.TVMAZE_API_KEY;
    if (key) {
        url.searchParams.set('api_key', key);
    }
    return url.toString();
}

/**
 * TVMaze removed ?tmdb= lookup. Resolve via TMDB external_ids → imdb / thetvdb.
 * @param {string|number} tmdbTvId
 * @param {Record<string, unknown>} [cache] - fetch cache options (e.g. `{ next: { revalidate: 1800 } }`)
 * @returns {Promise<number|null>}
 */
export async function resolveTvmazeShowIdFromTmdb(tmdbTvId, cache = {}) {
    const tmdb = String(tmdbTvId || '').trim();
    if (!tmdb) return null;

    try {
        const ext = await fetchTMDB(`/tv/${tmdb}/external_ids`);
        const imdb = ext?.imdb_id ? String(ext.imdb_id).trim() : '';
        const tvdbRaw = ext?.tvdb_id;
        const tvdb =
            tvdbRaw !== undefined && tvdbRaw !== null && tvdbRaw !== ''
                ? Number(tvdbRaw)
                : NaN;

        const urls = [];
        if (imdb) {
            urls.push(tvmazeFetchUrl(`/lookup/shows?imdb=${encodeURIComponent(imdb)}`));
        }
        if (!Number.isNaN(tvdb)) {
            urls.push(tvmazeFetchUrl(`/lookup/shows?thetvdb=${tvdb}`));
        }

        for (const url of urls) {
            const res = await fetch(url, { ...cache, headers: TVMAZE_HEADERS, redirect: 'follow' });
            if (res.status === 404) continue;
            if (!res.ok) continue;
            const data = await res.json();
            if (data?.id) return Number(data.id);
        }
    } catch (e) {
        console.error('TVMaze resolve (TMDB external_ids) failed:', e);
    }
    return null;
}
