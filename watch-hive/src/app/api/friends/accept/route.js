import { getServerUser, createServerClient } from '../../../lib/supabase-server';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * POST /api/friends/accept  body: { requestId }
 * Accept a pending friend request. Only the receiver (friend_id) can accept.
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

        const { error: updateErr } = await supabase
            .from('friends')
            .update({ status: 'accepted', updated_at: new Date().toISOString() })
            .eq('id', requestId);

        if (updateErr) throw updateErr;
        return jsonResponse({ success: true });
    } catch (err) {
        console.error('POST /api/friends/accept:', err);
        return jsonResponse({ error: 'Failed to accept request' }, 500);
    }
}
