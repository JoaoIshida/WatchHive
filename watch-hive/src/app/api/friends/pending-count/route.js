import { getServerUser, createServerClient } from '../../../lib/supabase-server';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * GET /api/friends/pending-count
 * Returns the number of pending friend requests received (invitations not yet accepted/declined).
 */
export async function GET() {
    try {
        const user = await getServerUser();
        if (!user) return jsonResponse({ count: 0 });

        const supabase = await createServerClient();
        const { count, error } = await supabase
            .from('friends')
            .select('id', { count: 'exact', head: true })
            .eq('friend_id', user.id)
            .eq('status', 'pending');

        if (error) throw error;
        return jsonResponse({ count: count ?? 0 });
    } catch (err) {
        console.error('GET /api/friends/pending-count:', err);
        return jsonResponse({ count: 0 }, 500);
    }
}
