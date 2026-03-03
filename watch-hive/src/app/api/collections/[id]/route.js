import { fetchTMDB } from '../../../api/utils';

const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=604800';

export async function GET(req, { params }) {
    const { id } = await params;

    if (!id) {
        return new Response(JSON.stringify({ error: 'Collection ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const data = await fetchTMDB(`/collection/${id}`, { language: 'en-CA' });

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': CACHE_CONTROL,
            },
        });
    } catch (error) {
        console.error('Error fetching collection:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch collection' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
