import { wishlistStorage } from '../../../lib/localStorage';

export async function GET(req) {
    try {
        const wishlist = wishlistStorage.getAll();
        return new Response(JSON.stringify({ wishlist }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch wishlist' }), {
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
        const { itemId, mediaType, dateAdded } = body;

        if (!itemId || !mediaType) {
            return new Response(JSON.stringify({ error: 'itemId and mediaType are required' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }

        const wishlist = wishlistStorage.add(itemId, mediaType, dateAdded);
        return new Response(JSON.stringify({ wishlist, success: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        return new Response(JSON.stringify({ error: 'Failed to add to wishlist' }), {
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

        const wishlist = wishlistStorage.remove(itemId, mediaType);
        return new Response(JSON.stringify({ wishlist, success: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        return new Response(JSON.stringify({ error: 'Failed to remove from wishlist' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

