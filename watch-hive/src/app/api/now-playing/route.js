import { fetchTMDB } from '../utils';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const language = searchParams.get('language') || 'en-US';
    const page = parseInt(searchParams.get('page')) || 1;

    try {
        const data = await fetchTMDB('/movie/now_playing', {
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
        console.error('Error fetching now playing movies:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch now playing movies' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

