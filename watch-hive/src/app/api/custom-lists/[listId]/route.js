import { getServerUser, createServerClient } from '../../../lib/supabase-server';

/**
 * GET /api/custom-lists/[listId]
 * Get a specific custom list with its items
 */
export async function GET(req, { params }) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { listId } = await params;
        const supabase = await createServerClient();

        // Get list
        const { data: list, error: listError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', listId)
            .single();

        if (listError) throw listError;

        // Check if user can view this list
        if (list.user_id !== user.id && !list.is_public) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get list items
        const { data: items, error: itemsError } = await supabase
            .from('custom_list_items')
            .select('*')
            .eq('list_id', listId)
            .order('date_added', { ascending: false });

        if (itemsError) throw itemsError;

        return new Response(JSON.stringify({ 
            list: {
                ...list,
                items: items || []
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching custom list:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch custom list' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * PUT /api/custom-lists/[listId]
 * Update a custom list
 */
export async function PUT(req, { params }) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { listId } = await params;
        const body = await req.json();
        const { name, description, isPublic } = body;

        const supabase = await createServerClient();

        // Check if user owns the list or is an admin collaborator
        const { data: list, error: listError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', listId)
            .single();

        if (listError) throw listError;

        // Check if user is owner or admin collaborator
        if (list.user_id !== user.id) {
            // Check if user is admin collaborator
            const { data: collaborator } = await supabase
                .from('list_collaborators')
                .select('*')
                .eq('list_id', listId)
                .eq('user_id', user.id)
                .eq('permission', 'admin')
                .single();

            if (!collaborator) {
                return new Response(JSON.stringify({ error: 'Forbidden' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // Build update object
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (isPublic !== undefined) updateData.is_public = isPublic;

        const { data, error } = await supabase
            .from('custom_lists')
            .update(updateData)
            .eq('id', listId)
            .select()
            .single();

        if (error) throw error;

        return new Response(JSON.stringify({ list: data, success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error updating custom list:', error);
        return new Response(JSON.stringify({ error: 'Failed to update custom list' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * DELETE /api/custom-lists/[listId]
 * Delete a custom list
 */
export async function DELETE(req, { params }) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { listId } = await params;
        const supabase = await createServerClient();

        // Check if user owns the list
        const { data: list, error: listError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', listId)
            .single();

        if (listError) throw listError;

        if (list.user_id !== user.id) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Delete list (items will be cascade deleted)
        const { error } = await supabase
            .from('custom_lists')
            .delete()
            .eq('id', listId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error deleting custom list:', error);
        return new Response(JSON.stringify({ error: 'Failed to delete custom list' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

