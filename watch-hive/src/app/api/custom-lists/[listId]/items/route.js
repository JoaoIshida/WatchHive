import { getServerUser, createServerClient } from '../../../../lib/supabase-server';

/**
 * GET /api/custom-lists/[listId]/items
 * Get all items in a custom list
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

        // Check if user can view this list
        const { data: list, error: listError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', listId)
            .single();

        if (listError) throw listError;

        if (list.user_id !== user.id && !list.is_public) {
            // Check if user is a collaborator
            const { data: collaborator } = await supabase
                .from('list_collaborators')
                .select('*')
                .eq('list_id', listId)
                .eq('user_id', user.id)
                .single();

            if (!collaborator) {
                return new Response(JSON.stringify({ error: 'Forbidden' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // Get list items
        const { data: items, error: itemsError } = await supabase
            .from('custom_list_items')
            .select('*')
            .eq('list_id', listId)
            .order('date_added', { ascending: false });

        if (itemsError) throw itemsError;

        return new Response(JSON.stringify({ items: items || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching list items:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch list items' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * POST /api/custom-lists/[listId]/items
 * Add an item to a custom list
 */
export async function POST(req, { params }) {
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
        const { contentId, mediaType, title } = body;

        if (!contentId || !mediaType || !title) {
            return new Response(JSON.stringify({ error: 'contentId, mediaType, and title are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();

        // Check if user can modify this list
        const { data: list, error: listError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', listId)
            .single();

        if (listError) throw listError;

        // Check if user is owner or editor/admin collaborator
        if (list.user_id !== user.id) {
            const { data: collaborator } = await supabase
                .from('list_collaborators')
                .select('*')
                .eq('list_id', listId)
                .eq('user_id', user.id)
                .in('permission', ['editor', 'admin'])
                .single();

            if (!collaborator) {
                return new Response(JSON.stringify({ error: 'Forbidden' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // Check if item already exists
        const { data: existing } = await supabase
            .from('custom_list_items')
            .select('*')
            .eq('list_id', listId)
            .eq('content_id', contentId)
            .eq('media_type', mediaType)
            .single();

        if (existing) {
            return new Response(JSON.stringify({ item: existing, success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Insert new item
        const { data, error } = await supabase
            .from('custom_list_items')
            .insert({
                list_id: listId,
                content_id: contentId,
                media_type: mediaType,
                title: title.trim(),
            })
            .select()
            .single();

        if (error) throw error;

        return new Response(JSON.stringify({ item: data, success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error adding item to list:', error);
        return new Response(JSON.stringify({ error: 'Failed to add item to list' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * DELETE /api/custom-lists/[listId]/items
 * Remove an item from a custom list
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
        const { searchParams } = new URL(req.url, 'http://localhost');
        const contentId = searchParams.get('contentId');
        const mediaType = searchParams.get('mediaType');

        if (!contentId || !mediaType) {
            return new Response(JSON.stringify({ error: 'contentId and mediaType are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();

        // Check if user can modify this list
        const { data: list, error: listError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', listId)
            .single();

        if (listError) throw listError;

        // Check if user is owner or editor/admin collaborator
        if (list.user_id !== user.id) {
            const { data: collaborator } = await supabase
                .from('list_collaborators')
                .select('*')
                .eq('list_id', listId)
                .eq('user_id', user.id)
                .in('permission', ['editor', 'admin'])
                .single();

            if (!collaborator) {
                return new Response(JSON.stringify({ error: 'Forbidden' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // Delete item
        const { error } = await supabase
            .from('custom_list_items')
            .delete()
            .eq('list_id', listId)
            .eq('content_id', contentId)
            .eq('media_type', mediaType);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error removing item from list:', error);
        return new Response(JSON.stringify({ error: 'Failed to remove item from list' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

