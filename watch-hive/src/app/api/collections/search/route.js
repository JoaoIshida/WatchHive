import { fetchTMDB } from '../../utils';

const CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const query = searchParams.get('query');
    const page = searchParams.get('page') || '1';

    if (!query || !query.trim()) {
        return new Response(JSON.stringify({ results: [], total_results: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const data = await fetchTMDB('/search/collection', {
            query: query.trim(),
            language: 'en-CA',
            page,
        });

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': CACHE_CONTROL,
            },
        });
    } catch (error) {
        console.error('Error searching collections:', error);
        return new Response(JSON.stringify({ error: 'Failed to search collections' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
