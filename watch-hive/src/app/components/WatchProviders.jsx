"use client";
import { useState } from 'react';
import { getProviderWatchUrl, isAllowedProviderOutboundUrl } from '../utils/watchProviderUrls';
import { TMDB_ID_TO_STREAM, providerLinkFromExplicitUrl } from '../utils/providerCanonicalLinks';
import ProviderIconLinks from './ProviderIconLinks';

/**
 * @param {unknown} p TMDB watch provider row
 * @param {unknown} hit Row from provider-links API (optional)
 * @param {string} linkEntityType
 */
function canonicalUrlForProviderRow(p, hit, linkEntityType) {
    let canonical_url = String(hit?.canonical_url || '').trim();
    if (
        canonical_url &&
        (!/^https?:\/\//i.test(canonical_url) || !isAllowedProviderOutboundUrl(canonical_url))
    ) {
        canonical_url = '';
    }
    if (!/^https?:\/\//i.test(canonical_url) && typeof p.link === 'string') {
        const parsed = providerLinkFromExplicitUrl(p.link.trim(), linkEntityType);
        if (parsed?.canonical_url) canonical_url = parsed.canonical_url.trim();
    }
    if (
        !/^https?:\/\//i.test(canonical_url) ||
        !canonical_url ||
        !isAllowedProviderOutboundUrl(canonical_url)
    ) {
        canonical_url = '';
    }
    return canonical_url;
}

const WatchProviders = ({
    providers,
    type = 'flatrate',
    title = '',
    linkContext = {},
    canonicalRows = null,
    linkEntityType = 'movie',
    lazyWatchmode = null,
}) => {
    const [showAll, setShowAll] = useState(false);
    const maxVisible = 6;
    const visibleProviders = showAll ? providers : providers.slice(0, maxVisible);
    const hasMore = providers.length > maxVisible;

    if (!providers || providers.length === 0) return null;

    const typeLabels = {
        flatrate: 'Available On',
        rent: 'Rent On',
        buy: 'Buy On',
    };

    const typeLabel = typeLabels[type] || 'Available On';
    const urlCtx = { title, ...linkContext };

    const byCanonicalId = Array.isArray(canonicalRows)
        ? new Map(canonicalRows.map((r) => [r.tmdb_provider_id, r]))
        : null;

    /** Every provider in this TMDB section (flatrate / rent / buy) — same Watchmode `availability` for the whole block. */
    const rowsForWatchIcons =
        byCanonicalId != null
            ? visibleProviders.map((p) => {
                  const hit = byCanonicalId.get(p.provider_id);
                  const canonical_url = canonicalUrlForProviderRow(p, hit, linkEntityType);
                  const openFallbackUrl = getProviderWatchUrl(
                      p.provider_id,
                      p.provider_name,
                      urlCtx,
                      { providerEntry: p }
                  );
                  return {
                      tmdb_provider_id: p.provider_id,
                      provider_name: p.provider_name,
                      logo_path: p.logo_path,
                      canonical_url,
                      openFallbackUrl,
                      provider: hit?.provider || TMDB_ID_TO_STREAM[p.provider_id],
                      tmdbAvailability: type,
                  };
              })
            : [];

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-amber-400/90">{typeLabel}</p>
                {hasMore && (
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
                    >
                        {showAll ? 'Show Less' : `+${providers.length - maxVisible} more`}
                    </button>
                )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                {byCanonicalId != null && rowsForWatchIcons.length > 0 ? (
                    <ProviderIconLinks
                        links={rowsForWatchIcons}
                        className="flex flex-wrap gap-2"
                        iconWrapperClass="h-12 w-12 rounded-lg border border-amber-500/30 bg-charcoal-800/60"
                        lazyWatchmode={
                            lazyWatchmode ? { ...lazyWatchmode, tmdbAvailability: type } : null
                        }
                    />
                ) : (
                    visibleProviders.map((provider) => (
                        <a
                            key={provider.provider_id}
                            href={getProviderWatchUrl(provider.provider_id, provider.provider_name, urlCtx, {
                                providerEntry: provider,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative flex items-center justify-center bg-charcoal-800/60 hover:bg-charcoal-700/80 border border-amber-500/30 hover:border-amber-400/60 rounded-lg p-2.5 transition-all hover:scale-105 hover:shadow-subtle"
                            title={`Open ${provider.provider_name}`}
                            aria-label={`Open ${provider.provider_name}`}
                        >
                            {provider.logo_path ? (
                                <img
                                    src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                    alt=""
                                    className="h-12 w-12 object-contain"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="text-xs text-amber-400 font-medium px-2 py-1">
                                    {provider.provider_name}
                                </span>
                            )}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-charcoal-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-amber-500/50">
                                {provider.provider_name}
                            </div>
                        </a>
                    ))
                )}
            </div>
        </div>
    );
};

export default WatchProviders;

