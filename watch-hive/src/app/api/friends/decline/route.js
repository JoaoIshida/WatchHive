import { getServerUser, createServerClient } from '../../../lib/supabase-server';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * POST /api/friends/decline  body: { requestId }
 * Decline (delete) a pending friend request. Only the receiver (friend_id) can decline.
 */
export async function POST(req) {
    try {
        const user = await getServerUser();
        if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

        const body = await req.json().catch(() => ({}));
        const requestId = body.requestId;
        if (!requestId) return jsonResponse({ error: 'requestId is required' }, 400);

        const supabase = await createServerClient();
        const { data: row, error: fetchErr } = await supabase
            .from('friends')
            .select('id, friend_id, status')
            .eq('id', requestId)
            .single();

        if (fetchErr || !row) return jsonResponse({ error: 'Request not found' }, 404);
        if (row.friend_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403);
        if (row.status !== 'pending') return jsonResponse({ error: 'Request is no longer pending' }, 400);

        // Delete the row so the sender can re-send later
        const { error: delErr } = await supabase
            .from('friends')
            .delete()
            .eq('id', requestId);

        if (delErr) throw delErr;
        return jsonResponse({ success: true });
    } catch (err) {
        console.error('POST /api/friends/decline:', err);
        return jsonResponse({ error: 'Failed to decline request' }, 500);
    }
}
