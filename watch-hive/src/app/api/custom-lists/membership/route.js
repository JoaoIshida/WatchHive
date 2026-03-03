import { getServerUser, createServerClient } from '../../../lib/supabase-server';

/**
 * GET /api/custom-lists/membership?contentId=<id>&mediaType=<movie|tv>
 * Returns list IDs (that the user can access) which contain the given item.
 * Single query replaces N calls to GET /api/custom-lists/[listId].
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

        const { searchParams } = new URL(req.url, 'http://localhost');
        const contentId = parseInt(searchParams.get('contentId'), 10);
        const mediaType = searchParams.get('mediaType');

        if (!contentId || !mediaType) {
            return new Response(JSON.stringify({ error: 'contentId and mediaType are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();

        // Get IDs of lists the user owns
        const { data: userLists } = await supabase
            .from('custom_lists')
            .select('id')
            .eq('user_id', user.id);

        // Get IDs of lists where user is collaborator
        const { data: collabRows } = await supabase
            .from('list_collaborators')
            .select('list_id')
            .eq('user_id', user.id);

        const accessibleListIds = [
            ...(userLists || []).map((l) => l.id),
            ...(collabRows || []).map((r) => r.list_id),
        ];

        if (accessibleListIds.length === 0) {
            return new Response(JSON.stringify({ listIds: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Find which of these lists contain the item
        const { data: items, error: itemsError } = await supabase
            .from('custom_list_items')
            .select('list_id')
            .in('list_id', accessibleListIds)
            .eq('content_id', contentId)
            .eq('media_type', mediaType);

        if (itemsError) throw itemsError;

        const listIds = [...new Set((items || []).map((i) => i.list_id))];

        return new Response(JSON.stringify({ listIds }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error checking list membership:', error);
        return new Response(JSON.stringify({ error: 'Failed to check list membership' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
