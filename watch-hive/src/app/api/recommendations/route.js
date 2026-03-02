import { getDiscoverRecommendations, getMultiTitleRecommendations } from '../../utils/recommendationEngine';

export async function POST(req) {
    try {
        const body = await req.json();
        const { titleId, mediaType, movieIds, seriesIds } = body;

        let recommendations;

        if (titleId && mediaType) {
            recommendations = await getDiscoverRecommendations(titleId, mediaType);
        } else if ((movieIds && movieIds.length > 0) || (seriesIds && seriesIds.length > 0)) {
            recommendations = await getMultiTitleRecommendations(
                movieIds || [],
                seriesIds || [],
            );
        } else {
            return new Response(
                JSON.stringify({ error: 'Provide titleId+mediaType or movieIds/seriesIds' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        return new Response(
            JSON.stringify({ recommendations }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to fetch recommendations' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}
