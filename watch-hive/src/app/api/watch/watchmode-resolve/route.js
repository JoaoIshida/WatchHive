import {
    canonicalizeStreamingWebUrl,
    watchmodeResolveProviderDeeplink,
    watchmodeTypesFromAvailabilityParam,
} from '../../../lib/watchmodeDeeplinks';
import { isAllowedProviderOutboundUrl, isProviderNativeSearchUrl } from '../../../utils/watchProviderUrls';

/**
 * GET /api/watch/watchmode-resolve?mediaType=movie|tv&tmdbId=123&region=CA&tmdbProviderId=9&providerName=...&availability=flatrate|rent|buy|sub|free|tve
 * `availability` maps TMDB sections to Watchmode source `type` (flatrate → sub). Called on icon click only.
 */
export async function GET(req) {
    const apiKey = process.env.WATCHMODE_API_KEY?.trim();
    if (!apiKey) {
        return Response.json({ url: null }, { status: 200 });
    }

    try {
        const url = new URL(req.url, 'http://localhost');
        const mediaType = String(url.searchParams.get('mediaType') || '').toLowerCase();
        const tmdbId = String(url.searchParams.get('tmdbId') || '').trim();
        const region = String(url.searchParams.get('region') || 'CA')
            .trim()
            .toUpperCase();
        const tmdbProviderId = Number(url.searchParams.get('tmdbProviderId'));
        const providerName = String(url.searchParams.get('providerName') || '').trim();
        const availabilityRaw = String(url.searchParams.get('availability') || '').trim();
        const watchmodeTypes = watchmodeTypesFromAvailabilityParam(availabilityRaw);

        if (!tmdbId || (mediaType !== 'movie' && mediaType !== 'tv') || !tmdbProviderId || Number.isNaN(tmdbProviderId)) {
            return Response.json({ error: 'mediaType, tmdbId, and tmdbProviderId are required' }, { status: 400 });
        }

        if (availabilityRaw && !watchmodeTypes) {
            return Response.json({ error: 'Invalid availability' }, { status: 400 });
        }

        const raw = await watchmodeResolveProviderDeeplink(
            apiKey,
            mediaType,
            tmdbId,
            region,
            tmdbProviderId,
            providerName,
            watchmodeTypes
        );
        const cleaned = raw ? canonicalizeStreamingWebUrl(raw) : '';
        const urlOut =
            cleaned &&
            isAllowedProviderOutboundUrl(cleaned) &&
            !isProviderNativeSearchUrl(cleaned)
                ? cleaned
                : null;

        return Response.json(
            { url: urlOut },
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'private, max-age=300',
                },
            }
        );
    } catch (e) {
        console.error('watchmode-resolve:', e);
        return Response.json({ url: null }, { status: 200 });
    }
}
