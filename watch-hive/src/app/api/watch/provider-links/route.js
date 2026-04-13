import { fetchTMDB } from '../../utils';
import { buildWatchProviderCanonicalLinks } from '../../../utils/providerCanonicalLinks';
import { enrichRegionalWatchBundle } from '../../../utils/tmdbWatchLinks';
import { pickTmdbWatchSectionForProvider } from '../../../utils/watchProviderUrls';

/**
 * GET /api/watch/provider-links?mediaType=movie|tv&tmdbId=123&region=CA&entityType=movie|series|episode
 * Returns outbound links from TMDB watch/providers only (Watchmode is resolved on icon click).
 */
export async function GET(req) {
    try {
        const url = new URL(req.url, 'http://localhost');
        const mediaType = String(url.searchParams.get('mediaType') || '').toLowerCase();
        const tmdbId = String(url.searchParams.get('tmdbId') || '').trim();
        const region = String(url.searchParams.get('region') || 'CA')
            .trim()
            .toUpperCase();
        const entityTypeRaw = String(url.searchParams.get('entityType') || '').toLowerCase();

        if (!tmdbId || (mediaType !== 'movie' && mediaType !== 'tv')) {
            return Response.json({ error: 'mediaType (movie|tv) and tmdbId are required' }, { status: 400 });
        }

        const entityType =
            entityTypeRaw === 'episode' || entityTypeRaw === 'series' || entityTypeRaw === 'movie'
                ? entityTypeRaw
                : mediaType === 'tv'
                  ? 'series'
                  : 'movie';

        const path = mediaType === 'movie' ? `movie/${tmdbId}/watch/providers` : `tv/${tmdbId}/watch/providers`;
        const data = await fetchTMDB(`/${path}`, { language: 'en-CA' });
        const enriched =
            enrichRegionalWatchBundle(data?.results, region) ?? (data?.results?.[region] ?? {});

        const lists = {
            flatrate: enriched.flatrate,
            rent: enriched.rent,
            buy: enriched.buy,
        };
        const links = buildWatchProviderCanonicalLinks({
            flatrate: lists.flatrate,
            rent: lists.rent,
            buy: lists.buy,
            entityType,
        }).map((row) => ({
            ...row,
            tmdbAvailability: pickTmdbWatchSectionForProvider(row.tmdb_provider_id, lists),
        }));

        return Response.json(
            { links },
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=120',
                },
            }
        );
    } catch (e) {
        console.error('provider-links:', e);
        return Response.json({ error: 'Failed to resolve provider links' }, { status: 500 });
    }
}
