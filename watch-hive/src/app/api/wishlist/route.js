import { getServerUser, createServerClient } from '../../lib/supabase-server';

export async function GET(req) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        const { data: wishlist, error } = await supabase
            .from('wishlist')
            .select('*')
            .eq('user_id', user.id)
            .order('date_added', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ wishlist: wishlist || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch wishlist' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function POST(req) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await req.json();
        const { itemId, mediaType, dateAdded } = body;

        if (!itemId || !mediaType) {
            return new Response(JSON.stringify({ error: 'itemId and mediaType are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        
        // Check if already exists
        const { data: existing } = await supabase
            .from('wishlist')
            .select('*')
            .eq('user_id', user.id)
            .eq('content_id', itemId)
            .eq('media_type', mediaType)
            .single();

        if (existing) {
            // Already in wishlist
            return new Response(JSON.stringify({ wishlist: existing, success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Insert new record
        const { data, error } = await supabase
            .from('wishlist')
            .insert({
                user_id: user.id,
                content_id: itemId,
                media_type: mediaType,
                date_added: dateAdded || new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        return new Response(JSON.stringify({ wishlist: data, success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        return new Response(JSON.stringify({ error: 'Failed to add to wishlist' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function DELETE(req) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { searchParams } = new URL(req.url, 'http://localhost');
        const itemId = searchParams.get('itemId');
        const mediaType = searchParams.get('mediaType');

        if (!itemId || !mediaType) {
            return new Response(JSON.stringify({ error: 'itemId and mediaType are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        const { error } = await supabase
            .from('wishlist')
            .delete()
            .eq('user_id', user.id)
            .eq('content_id', itemId)
            .eq('media_type', mediaType);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        return new Response(JSON.stringify({ error: 'Failed to remove from wishlist' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

