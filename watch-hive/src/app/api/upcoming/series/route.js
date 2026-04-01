import { fetchTMDB } from '../../utils';

/**
 * GET /api/upcoming/series
 * Proxies TMDB GET /tv/on_the_air — shows currently airing on TV in the last ~7 days (TMDB’s definition).
 * Pagination and totals match TMDB (native pages, not merged lists).
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const language = searchParams.get('language') || 'en-CA';

    if (page < 1 || page > 500) {
        return new Response(JSON.stringify({ error: 'Invalid page number' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const data = await fetchTMDB('/tv/on_the_air', {
            language,
            page,
        });

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching on-the-air series:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch on-the-air series' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
