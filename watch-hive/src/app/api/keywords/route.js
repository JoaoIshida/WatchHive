import { fetchTMDB } from '../utils';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const query = searchParams.get('query');

    if (!query || query.length < 2) {
        return new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        const data = await fetchTMDB('/search/keyword', {
            query: query,
            page: 1,
        });

        return new Response(JSON.stringify({
            results: data.results || [],
            total_results: data.total_results || 0,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error searching keywords:', error.message);
        return new Response(JSON.stringify({ error: 'Failed to search keywords' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

