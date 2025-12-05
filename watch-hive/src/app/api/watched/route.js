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
        const { data: watched, error } = await supabase
            .from('watched_content')
            .select('*')
            .eq('user_id', user.id)
            .order('date_watched', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ watched: watched || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching watched items:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch watched items' }), {
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
        const { itemId, mediaType, dateWatched } = body;

        if (!itemId || !mediaType) {
            return new Response(JSON.stringify({ error: 'itemId and mediaType are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        
        // Check if already exists
        const { data: existing } = await supabase
            .from('watched_content')
            .select('*')
            .eq('user_id', user.id)
            .eq('content_id', itemId)
            .eq('media_type', mediaType)
            .single();

        let result;
        if (existing) {
            // Update existing record - increment times_watched
            const { data, error } = await supabase
                .from('watched_content')
                .update({
                    times_watched: existing.times_watched + 1,
                    date_watched: dateWatched || new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        } else {
            // Insert new record
            const { data, error } = await supabase
                .from('watched_content')
                .insert({
                    user_id: user.id,
                    content_id: itemId,
                    media_type: mediaType,
                    date_watched: dateWatched || new Date().toISOString(),
                    times_watched: 1,
                })
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        }

        return new Response(JSON.stringify({ watched: result, success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error adding watched item:', error);
        return new Response(JSON.stringify({ error: 'Failed to add watched item' }), {
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
            .from('watched_content')
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
        console.error('Error removing watched item:', error);
        return new Response(JSON.stringify({ error: 'Failed to remove watched item' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

