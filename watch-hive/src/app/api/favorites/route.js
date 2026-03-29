import { getServerUser, createServerClient } from '../../lib/supabase-server';

export async function GET() {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        const { data: favorites, error } = await supabase
            .from('user_favorites')
            .select('*')
            .eq('user_id', user.id)
            .order('date_added', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ favorites: favorites || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch favorites' }), {
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

        const { data: existing } = await supabase
            .from('user_favorites')
            .select('*')
            .eq('user_id', user.id)
            .eq('content_id', itemId)
            .eq('media_type', mediaType)
            .maybeSingle();

        if (existing) {
            return new Response(JSON.stringify({ favorite: existing, success: true, alreadyExisted: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { data, error } = await supabase
            .from('user_favorites')
            .insert({
                user_id: user.id,
                content_id: itemId,
                media_type: mediaType,
                date_added: dateAdded || new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        return new Response(JSON.stringify({ favorite: data, success: true, alreadyExisted: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error adding favorite:', error);
        return new Response(JSON.stringify({ error: 'Failed to add favorite' }), {
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
            .from('user_favorites')
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
        console.error('Error removing favorite:', error);
        return new Response(JSON.stringify({ error: 'Failed to remove favorite' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
