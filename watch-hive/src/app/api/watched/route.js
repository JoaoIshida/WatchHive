import { watchedStorage } from '../../../lib/localStorage';

export async function GET(req) {
    try {
        const watched = watchedStorage.getAll();
        return new Response(JSON.stringify({ watched }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching watched items:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch watched items' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { itemId, mediaType, dateWatched } = body;

        if (!itemId || !mediaType) {
            return new Response(JSON.stringify({ error: 'itemId and mediaType are required' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }

        const watched = watchedStorage.add(itemId, mediaType, dateWatched);
        return new Response(JSON.stringify({ watched, success: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error adding watched item:', error);
        return new Response(JSON.stringify({ error: 'Failed to add watched item' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url, 'http://localhost');
        const itemId = searchParams.get('itemId');
        const mediaType = searchParams.get('mediaType');

        if (!itemId || !mediaType) {
            return new Response(JSON.stringify({ error: 'itemId and mediaType are required' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }

        const watched = watchedStorage.remove(itemId, mediaType);
        return new Response(JSON.stringify({ watched, success: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error removing watched item:', error);
        return new Response(JSON.stringify({ error: 'Failed to remove watched item' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

