import { isAllowedProviderOutboundUrl } from './watchProviderUrls';

/**
 * TMDB watch/providers: per-provider `link` may exist only on some regions. This helper copies the
 * first **allowed** (direct streaming) `link` per `provider_id` into the regional flatrate/rent/buy rows.
 * @see https://developer.themoviedb.org/reference/movie-watch-providers
 */

/**
 * Normalizes outbound `link` values on the **requested region’s** watch bundle only.
 * Does not copy `link` from other countries (e.g. US) into CA rows — those URLs are often
 * locale-specific storefronts and read as “US” to Canadian users.
 *
 * @param {Record<string, { link?: string, flatrate?: unknown[], rent?: unknown[], buy?: unknown[] }> | null | undefined} results
 * @param {string} [regionKey]
 * @returns {{ flatrate?: unknown[], rent?: unknown[], buy?: unknown[], link?: string } | null}
 */
export function enrichRegionalWatchBundle(results, regionKey = 'CA') {
    if (!results || typeof results !== 'object') return null;
    const region = String(regionKey || 'CA').toUpperCase();
    const bundle = results[region];
    if (!bundle || typeof bundle !== 'object') return null;

    /** @type {Map<number, string>} */
    const linkByPid = new Map();
    for (const list of [bundle.flatrate, bundle.rent, bundle.buy]) {
        if (!Array.isArray(list)) continue;
        for (const p of list) {
            const id = Number(p?.provider_id);
            const trimmed =
                typeof p?.link === 'string' && /^https?:\/\//i.test(p.link.trim()) ? p.link.trim() : '';
            const lk = trimmed && isAllowedProviderOutboundUrl(trimmed) ? trimmed : '';
            if (id && lk && !linkByPid.has(id)) linkByPid.set(id, lk);
        }
    }

    const patchList = (arr) =>
        Array.isArray(arr)
            ? arr.map((p) => {
                  const id = Number(p?.provider_id);
                  const ownRaw =
                      typeof p?.link === 'string' && /^https?:\/\//i.test(p.link.trim()) ? p.link.trim() : '';
                  const own = ownRaw && isAllowedProviderOutboundUrl(ownRaw) ? ownRaw : '';
                  const alt = id ? linkByPid.get(id) : '';
                  if (own) return p;
                  if (alt) return { ...p, link: alt };
                  if (ownRaw) return { ...p, link: '' };
                  return p;
              })
            : [];

    return {
        ...bundle,
        flatrate: patchList(bundle.flatrate),
        rent: patchList(bundle.rent),
        buy: patchList(bundle.buy),
    };
}
