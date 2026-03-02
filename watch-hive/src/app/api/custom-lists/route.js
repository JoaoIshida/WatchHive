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
        const { data: userLists, error: userError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (userError) throw userError;

        // Get lists where user is collaborator (private lists shared with user) with permission
        const { data: collabRows, error: collabError } = await supabase
            .from('list_collaborators')
            .select('list_id, permission')
            .eq('user_id', user.id);

        if (collabError) throw collabError;

        const collabPermissionByListId = new Map(
            (collabRows || []).map((r) => [r.list_id, r.permission])
        );

        let allLists = [...(userLists || [])].map((l) => ({ ...l, my_permission: 'owner' }));
        const userListIds = new Set((userLists || []).map((l) => l.id));

        if (collabRows && collabRows.length > 0) {
            const collabListIds = collabRows.map((r) => r.list_id).filter(Boolean);
            if (collabListIds.length > 0) {
                const { data: collabLists, error: collabListsError } = await supabase
                    .from('custom_lists')
                    .select('*')
                    .in('id', collabListIds);

                if (!collabListsError && collabLists) {
                    for (const list of collabLists) {
                        if (!userListIds.has(list.id)) {
                            const perm = collabPermissionByListId.get(list.id) || 'viewer';
                            allLists.push({ ...list, my_permission: perm });
                        }
                    }
                    allLists.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                }
            }
        }

        // Optionally include public lists from other users
        if (includePublic) {
            const { data: publicLists, error: publicError } = await supabase
                .from('custom_lists')
                .select('*')
                .eq('is_public', true)
                .neq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (publicError) throw publicError;

            const existingIds = new Set(allLists.map((l) => l.id));
            for (const list of publicLists || []) {
                if (!existingIds.has(list.id)) {
                    allLists.push({ ...list, my_permission: null });
                    existingIds.add(list.id);
                }
            }
            allLists.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        return new Response(JSON.stringify({ lists: allLists }), {
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

