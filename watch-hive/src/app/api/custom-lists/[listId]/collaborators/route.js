import { getServerUser, createServerClient } from '../../../../lib/supabase-server';

/**
 * GET /api/custom-lists/[listId]/collaborators
 * Get all collaborators for a list
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

        // Check if user can view collaborators
        const { data: list, error: listError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', listId)
            .single();

        if (listError) throw listError;

        if (list.user_id !== user.id) {
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

        // Get collaborators with profile info
        const { data: collaborators, error: collabError } = await supabase
            .from('list_collaborators')
            .select(`
                *,
                profiles:user_id (
                    id,
                    display_name,
                    avatar_url
                )
            `)
            .eq('list_id', listId)
            .order('created_at', { ascending: true });

        if (collabError) throw collabError;

        return new Response(JSON.stringify({ collaborators: collaborators || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching collaborators:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch collaborators' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * POST /api/custom-lists/[listId]/collaborators
 * Add a collaborator to a list
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
        const { userId, permission } = body;

        if (!userId || !permission) {
            return new Response(JSON.stringify({ error: 'userId and permission are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!['viewer', 'editor', 'admin'].includes(permission)) {
            return new Response(JSON.stringify({ error: 'Invalid permission. Must be viewer, editor, or admin' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();

        // Check if user can add collaborators (owner or admin)
        const { data: list, error: listError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', listId)
            .single();

        if (listError) throw listError;

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

        // Check if already a collaborator
        const { data: existing } = await supabase
            .from('list_collaborators')
            .select('*')
            .eq('list_id', listId)
            .eq('user_id', userId)
            .single();

        if (existing) {
            // Update existing collaborator
            const { data, error } = await supabase
                .from('list_collaborators')
                .update({ permission })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw error;
            return new Response(JSON.stringify({ collaborator: data, success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Insert new collaborator
        const { data, error } = await supabase
            .from('list_collaborators')
            .insert({
                list_id: listId,
                user_id: userId,
                permission,
            })
            .select()
            .single();

        if (error) throw error;

        return new Response(JSON.stringify({ collaborator: data, success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error adding collaborator:', error);
        return new Response(JSON.stringify({ error: 'Failed to add collaborator' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * DELETE /api/custom-lists/[listId]/collaborators
 * Remove a collaborator from a list
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
        const userId = searchParams.get('userId');

        if (!userId) {
            return new Response(JSON.stringify({ error: 'userId is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();

        // Check if user can remove collaborators (owner or admin)
        const { data: list, error: listError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', listId)
            .single();

        if (listError) throw listError;

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

        // Delete collaborator
        const { error } = await supabase
            .from('list_collaborators')
            .delete()
            .eq('list_id', listId)
            .eq('user_id', userId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error removing collaborator:', error);
        return new Response(JSON.stringify({ error: 'Failed to remove collaborator' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

