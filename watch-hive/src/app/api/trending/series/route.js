import { fetchTMDB } from '../../utils';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const language = searchParams.get('language') || 'en-US';

    try {
        const data = await fetchTMDB('/trending/tv/week', {
            language: language,
        });

        return new Response(JSON.stringify(data.results), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching trending series:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch trending series' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
