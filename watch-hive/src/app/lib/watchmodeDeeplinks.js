/**
 * Watchmode API — streaming deeplinks by TMDB id.
 * @see https://api.watchmode.com/ — set WATCHMODE_API_KEY in env (server only).
 *
 * Title sources (canonical streaming URLs for the browser) are loaded with the same shape as:
 *
 *   curl -i 'https://api.watchmode.com/v1/title/345534/sources/?apiKey=YOUR_API_KEY'
 *
 * Response is a JSON array of objects; for web we use **`web_url`** only (iOS/Android fields may be
 * placeholders on free plans — see Watchmode docs).
 *
 * Each row has Watchmode `type`: **sub** | **rent** | **buy** | **free** | **tve**. Resolve on click
 * must filter by the same availability as the TMDB section shown (flatrate → sub, rent, buy).
 */

const WATCHMODE_BASE = 'https://api.watchmode.com/v1';

/**
 * Strip Amazon/Prime tracking path segments (e.g. `/ref=atv_...`) for cleaner canonical URLs.
 * @param {string} url
 * @returns {string}
 */
export function canonicalizeStreamingWebUrl(url) {
    const s = String(url || '').trim();
    if (!/^https?:\/\//i.test(s)) return s;
    try {
        const u = new URL(s);
        const host = u.hostname.replace(/^www\./, '').toLowerCase();
        if (!host.endsWith('primevideo.com')) return s;
        const parts = u.pathname.split('/').filter(Boolean);
        const refIdx = parts.findIndex(
            (p) => p.toLowerCase() === 'ref' || p.toLowerCase().startsWith('ref=')
        );
        if (refIdx === -1) return s;
        u.pathname = `/${parts.slice(0, refIdx).join('/')}`;
        return u.toString();
    } catch {
        return s;
    }
}

/**
 * @param {string} name
 * @returns {string}
 */
function normProviderName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/\s*\+\s*/g, ' plus ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function providerNamesMatch(a, b) {
    const x = normProviderName(a);
    const y = normProviderName(b);
    if (!x || !y) return false;
    if (x === y) return true;
    if (x.includes(y) || y.includes(x)) return true;
    return false;
}

/**
 * @param {string} apiKey
 * @param {'movie'|'tv'} mediaType
 * @param {string} tmdbId
 * @returns {Promise<number|null>}
 */
export async function watchmodeFindTitleId(apiKey, mediaType, tmdbId) {
    const field = mediaType === 'movie' ? 'tmdb_movie_id' : 'tmdb_tv_id';
    const qs = new URLSearchParams({
        apiKey,
        search_field: field,
        search_value: String(tmdbId),
    });
    const res = await fetch(`${WATCHMODE_BASE}/search?${qs.toString()}`, {
        next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success === false) return null;
    const list = Array.isArray(data?.title_results) ? data.title_results : [];
    const first = list.find((t) => t?.id != null && !Number.isNaN(Number(t.id)));
    return first ? Number(first.id) : null;
}

/**
 * GET /v1/title/{title_id}/sources/?apiKey=…&regions=… — returns a JSON array of source objects with `web_url`.
 * @param {string} apiKey
 * @param {number} titleId Watchmode title id
 * @param {string} [regions] comma-separated ISO codes e.g. CA,US (optional but recommended)
 * @returns {Promise<Array<{ source_id?: number, name?: string, type?: string, region?: string, web_url?: string, ios_url?: string, android_url?: string }>>}
 */
export async function watchmodeFetchTitleSources(apiKey, titleId, regions) {
    const basePath = `${WATCHMODE_BASE}/title/${encodeURIComponent(String(titleId))}/sources/`;
    const u = new URL(basePath);
    u.searchParams.set('apiKey', apiKey);
    if (regions && String(regions).trim()) {
        u.searchParams.set('regions', String(regions).trim());
    }
    const res = await fetch(u.toString(), {
        next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data && data.success === false) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.sources)) return data.sources;
    return [];
}

/**
 * True when `web_url` is a real browser URL (Watchmode may put plan-limit strings in deeplink fields).
 * @param {string} url
 * @returns {boolean}
 */
function isUsableWatchmodeWebUrl(url) {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) return false;
    if (/paid plans only/i.test(u)) return false;
    if (/episode links available/i.test(u)) return false;
    return true;
}

/**
 * Prefer **`web_url`** from a Watchmode title source row (do not use ios_url / android_url for web).
 * @param {{ web_url?: string }} entry
 * @returns {string}
 */
function pickWatchmodeSourceWebUrl(entry) {
    const w = entry && typeof entry.web_url === 'string' ? entry.web_url.trim() : '';
    return isUsableWatchmodeWebUrl(w) ? w : '';
}

/**
 * Map UI / TMDB section or direct Watchmode labels to Watchmode title `type` values.
 * @param {string} availability e.g. flatrate, rent, buy, or sub|rent|buy|free|tve
 * @returns {string[]|null} null = do not filter by type (legacy)
 */
export function watchmodeTypesFromAvailabilityParam(availability) {
    const s = String(availability || '').trim().toLowerCase();
    if (!s) return null;
    if (s === 'flatrate') return ['sub'];
    if (s === 'rent') return ['rent'];
    if (s === 'buy') return ['buy'];
    if (s === 'ads' || s === 'free') return ['free'];
    if (s === 'tve') return ['tve'];
    if (s === 'sub' || s === 'rent' || s === 'buy' || s === 'free' || s === 'tve') return [s];
    return null;
}

/**
 * Map Watchmode sources to TMDB provider_id using provider display names.
 * @param {Array<{ source_id?: number, name?: string, web_url?: string, region?: string, type?: string }>} sources
 * @param {unknown[]} flatrate
 * @param {unknown[]} rent
 * @param {unknown[]} buy
 * @param {string} preferredRegion uppercased ISO2
 * @param {string[]|null} [watchmodeTypes] when set, only sources whose `type` is in this list (Watchmode enum)
 * @returns {Map<number, string>} tmdb_provider_id -> web_url
 */
function matchWatchmodeSourcesToTmdbProviders(
    sources,
    flatrate,
    rent,
    buy,
    preferredRegion,
    watchmodeTypes = null
) {
    /** @type {Map<number, string>} */
    const out = new Map();
    const region = String(preferredRegion || 'CA').toUpperCase();
    const rows = [];
    for (const list of [flatrate || [], rent || [], buy || []]) {
        for (const p of list) {
            const id = Number(p?.provider_id);
            const name = p?.provider_name;
            if (!id || !name) continue;
            rows.push({ id, name });
        }
    }
    const seen = new Set();
    const uniqueRows = rows.filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
    });

    const rawSources = Array.isArray(sources) ? sources : [];
    const typeSet =
        Array.isArray(watchmodeTypes) && watchmodeTypes.length > 0
            ? new Set(watchmodeTypes.map((t) => String(t || '').toLowerCase()))
            : null;
    const filtered = typeSet
        ? rawSources.filter((s) => typeSet.has(String(s?.type || '').toLowerCase()))
        : rawSources;

    const scored = filtered.map((s, i) => {
        const r = String(s?.region || '').toUpperCase();
        let score = 0;
        if (r === region) score = 3;
        else if (r === 'US') score = 2;
        else if (!r) score = 1;
        return { s, score, i };
    });
    scored.sort((a, b) => b.score - a.score || a.i - b.i);

    for (const { s: wm } of scored) {
        const rawUrl = pickWatchmodeSourceWebUrl(wm);
        if (!rawUrl) continue;
        const wmName = wm?.name;
        if (!wmName) continue;
        for (const { id, name } of uniqueRows) {
            if (out.has(id)) continue;
            if (providerNamesMatch(wmName, name)) {
                out.set(id, canonicalizeStreamingWebUrl(rawUrl));
                break;
            }
        }
    }
    return out;
}

/**
 * Resolve one provider deeplink via Watchmode (on-demand; do not call on page load).
 * @param {string} apiKey
 * @param {'movie'|'tv'} mediaType
 * @param {string|number} tmdbId
 * @param {string} region ISO2
 * @param {number} tmdbProviderId
 * @param {string} providerName TMDB provider display name
 * @param {string[]|null} [watchmodeTypes] Watchmode source `type` filter (e.g. ['sub'] for TMDB flatrate)
 * @returns {Promise<string|null>}
 */
export async function watchmodeResolveProviderDeeplink(
    apiKey,
    mediaType,
    tmdbId,
    region,
    tmdbProviderId,
    providerName,
    watchmodeTypes = null
) {
    const wmTitleId = await watchmodeFindTitleId(
        apiKey,
        mediaType === 'movie' ? 'movie' : 'tv',
        String(tmdbId)
    );
    if (wmTitleId == null) return null;
    const reg = String(region || 'CA').toUpperCase();
    const sources = await watchmodeFetchTitleSources(apiKey, wmTitleId, `${reg},US`);
    const stub = [{ provider_id: Number(tmdbProviderId), provider_name: String(providerName || ' ') }];
    const map = matchWatchmodeSourcesToTmdbProviders(sources, stub, [], [], reg, watchmodeTypes);
    return map.get(Number(tmdbProviderId)) || null;
}
