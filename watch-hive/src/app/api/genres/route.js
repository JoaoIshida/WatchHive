import { fetchTMDB } from '../utils';

export async function GET(req) {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const type = searchParams.get('type') || 'movie'; // 'movie' or 'tv'

    try {
        const data = await fetchTMDB(`/genre/${type}/list`, {
            language: 'en-US',
        });

        return new Response(JSON.stringify(data.genres || []), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching genres:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch genres' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

