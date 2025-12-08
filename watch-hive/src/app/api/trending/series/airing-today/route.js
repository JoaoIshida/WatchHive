import { fetchTMDB } from '../../../utils';

/**
 * GET /api/trending/series/airing-today
 * Get TV series that have an episode airing today
 * Uses TMDB's /tv/airing_today endpoint which returns series based on next episode to air
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const language = searchParams.get('language') || 'en-CA';

    try {
        // Get series with episodes airing today
        // TMDB's airing_today endpoint returns series where the next episode to air is today
        const data = await fetchTMDB('/tv/airing_today', {
            language: language,
            page: page,
        });

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching airing today series:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch airing today series' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
