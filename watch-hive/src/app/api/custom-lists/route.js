import { getServerUser, createServerClient } from '../../lib/supabase-server';

/**
 * GET /api/custom-lists
 * Get all custom lists for the authenticated user (and public lists)
 */
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
        const { searchParams } = new URL(req.url, 'http://localhost');
        const includePublic = searchParams.get('includePublic') === 'true';

        // Get user's lists
        // Uses index: idx_custom_lists_user_id, idx_custom_lists_created_at
        let query = supabase
            .from('custom_lists')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        // Optionally include public lists from other users
        if (includePublic) {
            // Uses index: idx_custom_lists_public (partial index for public lists)
            const { data: publicLists, error: publicError } = await supabase
                .from('custom_lists')
                .select('*')
                .eq('is_public', true)
                .neq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (publicError) throw publicError;

            const { data: userLists, error: userError } = await query;
            if (userError) throw userError;

            return new Response(JSON.stringify({ 
                lists: [...(userLists || []), ...(publicLists || [])] 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { data: lists, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ lists: lists || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching custom lists:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch custom lists' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * POST /api/custom-lists
 * Create a new custom list
 */
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
        const { name, description, isPublic } = body;

        if (!name || !name.trim()) {
            return new Response(JSON.stringify({ error: 'List name is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        const { data, error } = await supabase
            .from('custom_lists')
            .insert({
                user_id: user.id,
                name: name.trim(),
                description: description?.trim() || null,
                is_public: isPublic || false,
            })
            .select()
            .single();

        if (error) throw error;

        return new Response(JSON.stringify({ list: data, success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error creating custom list:', error);
        return new Response(JSON.stringify({ error: 'Failed to create custom list' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

