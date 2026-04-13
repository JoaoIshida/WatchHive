/**
 * Resolve outbound URLs for TMDB watch providers.
 *
 * @see ./streamingOutboundUrlReference.md — deep-link shapes and TMDB `provider_id` search fallbacks.
 *
 * TMDB’s JSON does not always include per-provider deep links (e.g. Prime `gti` URLs). If
 * `providerEntry.link` is a direct streaming URL, we use it. TMDB/JustWatch/TVMaze funnel links
 * are skipped so users never land on aggregator watch pages.
 */

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isAllowedProviderOutboundUrl(url) {
    try {
        const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
        if (host.endsWith("themoviedb.org")) return false;
        if (host.endsWith("justwatch.com")) return false;
        if (host.endsWith("tvmaze.com")) return false;
        return true;
    } catch {
        return false;
    }
}

/**
 * True for native site search URLs (used to decide when Watchmode/TMDB deeplinks should replace).
 * @param {string} url
 * @returns {boolean}
 */
export function isProviderNativeSearchUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, "").toLowerCase();
        const path = u.pathname.toLowerCase();
        const q = u.search.toLowerCase();
        if (path.includes("/search")) return true;
        if (host.endsWith("netflix.com") && q.includes("q=")) return true;
        if (host.endsWith("disneyplus.com") && path.includes("/browse/search")) return true;
        if (host.endsWith("hulu.com") && path.includes("/hub/search")) return true;
        if (host.endsWith("primevideo.com") && q.includes("phrase=")) return true;
        if (host.endsWith("tv.apple.com") && path.includes("/search")) return true;
        if (host.endsWith("max.com") || host.endsWith("play.max.com")) {
            if (path.includes("/search") || q.includes("q=")) return true;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * @param {number} providerId - TMDB provider_id
 * @param {string} providerName
 * @param {{ title?: string, seriesTitle?: string, seasonNumber?: number, episodeNumber?: number }} ctx
 * @param {{ providerEntry?: { link?: string } | null }} [opts]
 * @returns {string}
 */
export function getProviderWatchUrl(providerId, providerName, ctx = {}, opts = {}) {
    const { providerEntry } = opts;
    const raw =
        providerEntry &&
        typeof providerEntry.link === "string" &&
        /^https?:\/\//i.test(providerEntry.link.trim())
            ? providerEntry.link.trim()
            : "";
    if (raw && isAllowedProviderOutboundUrl(raw)) return raw;

    const { title = '', seriesTitle, seasonNumber, episodeNumber } = ctx;
    const primary = (seriesTitle || title || '').trim();
    const hasEpisode =
        typeof seasonNumber === 'number' &&
        typeof episodeNumber === 'number' &&
        !Number.isNaN(seasonNumber) &&
        !Number.isNaN(episodeNumber);

    const se =
        hasEpisode && primary
            ? `${primary} S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`
            : primary;

    const enc = encodeURIComponent(se || title || '');
    const amazonTag =
        typeof process !== 'undefined' && process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG
            ? String(process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG).trim()
            : '';
    const primeSuffix = amazonTag
        ? `&linkCode=xm2&tag=${encodeURIComponent(amazonTag)}`
        : '';
    const primeSearchUrl = `https://www.primevideo.com/search?phrase=${enc}${primeSuffix}`;

    const byId = {
        8: `https://www.netflix.com/search?q=${enc}`,
        9: primeSearchUrl,
        /** Amazon Prime Video (alternate TMDB id) */
        119: primeSearchUrl,
        /** Prime Video with Ads */
        2100: primeSearchUrl,
        337: `https://www.disneyplus.com/browse/search?q=${enc}`,
        /** Hulu — hub search when no `/watch/{id}` deep link */
        15: `https://www.hulu.com/hub/search?q=${enc}`,
        350: `https://tv.apple.com/search?term=${enc}`,
        384: `https://play.max.com/search?q=${enc}`,
        1899: `https://play.max.com/search?q=${enc}`,
        531: `https://www.paramountplus.com/search/?q=${enc}`,
        61: `https://www.crave.ca/en/search?q=${enc}`,
        2300: `https://www.crave.ca/en/search?q=${enc}`,
        386: `https://www.peacocktv.com/search?q=${enc}`,
        387: `https://www.peacocktv.com/search?q=${enc}`,
        283: `https://www.crunchyroll.com/search?q=${enc}`,
        1796: `https://www.netflix.com/search?q=${enc}`,
    };

    if (byId[providerId]) {
        return byId[providerId];
    }

    const label = (providerName || 'streaming').trim();
    const q = encodeURIComponent(`where to watch ${se || title} ${label}`.trim());
    return `https://www.google.com/search?q=${q}`;
}

/**
 * Prefer subscription providers first, then rent/buy; dedupe by provider_id.
 */
export function mergeUniqueProviders(flatrate, rent, buy) {
    const seen = new Set();
    const out = [];
    for (const list of [flatrate || [], rent || [], buy || []]) {
        for (const p of list) {
            if (!p?.provider_id || seen.has(p.provider_id)) continue;
            seen.add(p.provider_id);
            out.push(p);
        }
    }
    return out;
}

/**
 * Pick which TMDB watch list applies for Watchmode `type` filtering (flatrate → sub, etc.).
 * Priority: subscription row first, then rent, then buy.
 *
 * @param {string|number} providerId
 * @param {{ flatrate?: unknown[], rent?: unknown[], buy?: unknown[] }} lists
 * @returns {'flatrate'|'rent'|'buy'}
 */
export function pickTmdbWatchSectionForProvider(providerId, lists) {
    const pid = Number(providerId);
    if (!pid) return 'flatrate';
    const flatrate = lists?.flatrate || [];
    const rent = lists?.rent || [];
    const buy = lists?.buy || [];
    if (flatrate.some((p) => Number(p?.provider_id) === pid)) return 'flatrate';
    if (rent.some((p) => Number(p?.provider_id) === pid)) return 'rent';
    if (buy.some((p) => Number(p?.provider_id) === pid)) return 'buy';
    return 'flatrate';
}
