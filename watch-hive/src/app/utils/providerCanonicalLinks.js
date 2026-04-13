/**
 * Canonical outbound links for major streaming providers (no homepages).
 *
 * @see ./streamingOutboundUrlReference.md — URL shapes and TMDB provider search fallbacks.
 *
 * @typedef {'netflix' | 'primevideo' | 'disneyplus' | 'hulu'} StreamProviderId
 * @typedef {'movie' | 'series' | 'episode'} ProviderEntityType
 */

import { isAllowedProviderOutboundUrl, mergeUniqueProviders } from './watchProviderUrls';

/** @type {Record<number, StreamProviderId>} */
export const TMDB_ID_TO_STREAM = {
    8: 'netflix',
    1796: 'netflix',
    9: 'primevideo',
    119: 'primevideo',
    2100: 'primevideo',
    337: 'disneyplus',
    390: 'disneyplus',
    15: 'hulu',
};

/**
 * @param {string} url
 * @returns {boolean}
 */
function isLikelyProviderHomepage(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, '');
        const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
        if (host.endsWith('netflix.com')) {
            return path === '/' || /^\/browse\b/i.test(path);
        }
        if (host.endsWith('primevideo.com') || host.endsWith('amazon.com')) {
            return path === '/' || /^\/storefront$/i.test(path);
        }
        if (host.endsWith('disneyplus.com')) {
            if (path === '/') return true;
            if (/^\/home(\/|$)/i.test(path)) return true;
            if (/^\/browse\/search\b/i.test(path)) return true;
            if (/^\/browse\/?$/i.test(path)) return true;
            return false;
        }
        if (host.endsWith('hulu.com')) {
            return path === '/' || /^\/hub\/home/i.test(path);
        }
    } catch {
        return true;
    }
    return false;
}

/**
 * Accepts direct streaming URLs from TMDB `link` when they are not generic home/search hubs.
 *
 * @see ./streamingOutboundUrlReference.md
 * @param {string} rawUrl
 * @param {ProviderEntityType} entityType
 * @returns {{ provider: StreamProviderId, entity_type: ProviderEntityType, canonical_url: string, external_id: string, is_exact_episode: boolean } | null}
 */
export function providerLinkFromExplicitUrl(rawUrl, entityType) {
    const canonical_url = String(rawUrl || '').trim();
    if (!/^https?:\/\//i.test(canonical_url) || isLikelyProviderHomepage(canonical_url)) return null;

    let host;
    try {
        host = new URL(canonical_url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }

    /** @type {StreamProviderId | null} */
    let provider = null;
    if (host.endsWith('netflix.com')) provider = 'netflix';
    else if (host.endsWith('primevideo.com') || host.includes('amazon.')) provider = 'primevideo';
    else if (host.endsWith('disneyplus.com')) provider = 'disneyplus';
    else if (host.endsWith('hulu.com')) provider = 'hulu';
    else return null;

    let external_id = '';
    if (provider === 'netflix') {
        const m = canonical_url.match(
            /netflix\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:title|watch)\/([^/?#]+)/i
        );
        external_id = m ? m[1] : '';
    } else if (provider === 'primevideo') {
        const gti = canonical_url.match(/[?&]gti=([^&]+)/i);
        if (gti) external_id = decodeURIComponent(gti[1]);
        else {
            const detail = canonical_url.match(/primevideo\.com\/detail\/([^?#]+)/i);
            if (detail) {
                const segments = detail[1].replace(/\/+$/, '').split('/').filter(Boolean);
                if (segments.length >= 2) external_id = segments[segments.length - 1] || '';
                else if (segments.length === 1) external_id = segments[0] || '';
            }
        }
    } else if (provider === 'disneyplus') {
        const m = canonical_url.match(/disneyplus\.com\/(?:movies|series)\/[^/]+\/([^/?#]+)/i);
        external_id = m ? m[1] : '';
        if (!external_id) {
            const e = canonical_url.match(/entity-([0-9a-f-]{36})/i);
            external_id = e ? e[1] : '';
        }
    } else if (provider === 'hulu') {
        const m = canonical_url.match(/hulu\.com\/watch\/([^/?#]+)/i);
        external_id = m ? m[1] : '';
    }

    const is_exact_episode =
        entityType === 'episode' &&
        (/\/watch\/[^/]+/i.test(canonical_url) ||
            /[?&]gti=amzn1\.dv\.gti\./i.test(canonical_url) ||
            /hulu\.com\/watch\//i.test(canonical_url) ||
            /disneyplus\.com\/.+\/(episode|video)/i.test(canonical_url));

    return {
        provider,
        entity_type: entityType,
        canonical_url,
        external_id,
        is_exact_episode,
    };
}

/**
 * @param {object} args
 * @param {unknown[]} [args.flatrate]
 * @param {unknown[]} [args.rent]
 * @param {unknown[]} [args.buy]
 * @param {ProviderEntityType} args.entityType
 */
export function buildWatchProviderCanonicalLinks({
    flatrate,
    rent,
    buy,
    entityType,
}) {
    const merged = mergeUniqueProviders(flatrate, rent, buy);
    /** @type {Map<StreamProviderId, { provider: StreamProviderId, entity_type: ProviderEntityType, canonical_url: string, external_id: string, is_exact_episode: boolean, tmdb_provider_id: number, provider_name: string, logo_path: string | null }>} */
    const byStream = new Map();

    for (const p of merged) {
        const pid = Number(p.provider_id);
        const stream = TMDB_ID_TO_STREAM[pid];
        if (!stream) continue;

        const fromApi =
            p.link && typeof p.link === 'string' ? providerLinkFromExplicitUrl(p.link, entityType) : null;

        let canonical_url = String(fromApi?.canonical_url || '').trim();
        if (canonical_url && !isAllowedProviderOutboundUrl(canonical_url)) canonical_url = '';
        let external_id = fromApi?.external_id || '';
        let is_exact_episode = !!fromApi?.is_exact_episode;

        const row = {
            provider: stream,
            entity_type: entityType,
            canonical_url,
            external_id,
            is_exact_episode,
            tmdb_provider_id: pid,
            provider_name: p.provider_name || '',
            logo_path: p.logo_path || null,
        };

        const prev = byStream.get(stream);
        if (!prev || (!prev.canonical_url && canonical_url)) {
            byStream.set(stream, row);
        }
    }

    return [...byStream.values()];
}
