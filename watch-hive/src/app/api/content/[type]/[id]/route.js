import { fetchTMDB } from '../../../utils';

export async function GET(req, { params }) {
    const { type, id } = params;

    if (!type || !id) {
        return new Response(JSON.stringify({ error: 'Type and ID are required' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    if (type !== 'movie' && type !== 'tv') {
        return new Response(JSON.stringify({ error: 'Type must be movie or tv' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        const data = await fetchTMDB(`/${type}/${id}`, {
            language: 'en-US',
        });

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error(`Error fetching ${type} details:`, error);
        return new Response(JSON.stringify({ error: `Failed to fetch ${type} details` }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

