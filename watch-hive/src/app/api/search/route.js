import { fetchTMDB } from '../utils';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const query = searchParams.get('query');
    const language = searchParams.get('language') || 'en-US';

    if (!query) {
        return new Response(JSON.stringify({ error: 'Query parameter is required' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        // Use multi-search endpoint to search both movies and TV series
        const data = await fetchTMDB('/search/multi', {
            query: query,
            include_adult: false,
            language: language,
            page: 1,
        });

        // Filter to only include movies and TV series (exclude people)
        const filteredResults = data.results.filter(
            item => item.media_type === 'movie' || item.media_type === 'tv'
        );

        return new Response(JSON.stringify(filteredResults), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching search results:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch search results' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
