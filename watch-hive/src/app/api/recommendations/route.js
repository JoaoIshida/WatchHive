import { unstable_cache } from 'next/cache';
import { getDiscoverRecommendations, getMultiTitleRecommendations } from '../../utils/recommendationEngine';

const CACHE_CONTROL_GET = 'public, s-maxage=86400, stale-while-revalidate=604800';

function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
    });
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const titleId = searchParams.get('titleId');
        const mediaType = searchParams.get('mediaType');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);

        if (!titleId || !mediaType) {
            return jsonResponse(
                { error: 'Query params titleId and mediaType are required' },
                400
            );
        }
        if (mediaType !== 'movie' && mediaType !== 'tv') {
            return jsonResponse({ error: 'mediaType must be movie or tv' }, 400);
        }

        const recommendations = await getDiscoverRecommendations(titleId, mediaType, { limit });

        return new Response(JSON.stringify({ recommendations }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': CACHE_CONTROL_GET,
            },
        });
    } catch (error) {
        console.error('Error fetching recommendations (GET):', error);
        return jsonResponse({ error: 'Failed to fetch recommendations' }, 500);
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { titleId, mediaType, movieIds, seriesIds } = body;
        const limit = Math.min(parseInt(body.limit, 10) || 20, 50);

        let recommendations;

        if (titleId && mediaType) {
            recommendations = await getDiscoverRecommendations(titleId, mediaType, { limit });
        } else if ((movieIds && movieIds.length > 0) || (seriesIds && seriesIds.length > 0)) {
            const sortedMovieIds = [...(movieIds || [])].sort((a, b) => a - b);
            const sortedSeriesIds = [...(seriesIds || [])].sort((a, b) => a - b);
            const cacheKey = `rec:mix:${sortedMovieIds.join(',')}:${sortedSeriesIds.join(',')}:${limit}`;
            recommendations = await unstable_cache(
                async () => {
                    return getMultiTitleRecommendations(movieIds || [], seriesIds || [], { limit });
                },
                [cacheKey],
                { revalidate: 3600 }
            )();
        } else {
            return jsonResponse(
                { error: 'Provide titleId+mediaType or movieIds/seriesIds' },
                400
            );
        }

        return jsonResponse({ recommendations });
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return jsonResponse({ error: 'Failed to fetch recommendations' }, 500);
    }
}
