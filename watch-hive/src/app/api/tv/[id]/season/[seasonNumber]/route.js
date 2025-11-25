import { fetchTMDB } from '../../../../utils';

export async function GET(req, { params }) {
    const { id, seasonNumber } = params;

    if (!id || !seasonNumber) {
        return new Response(JSON.stringify({ error: 'Series ID and season number are required' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        const data = await fetchTMDB(`/tv/${id}/season/${seasonNumber}`, {
            language: 'en-US',
        });

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching season details:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch season details' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

