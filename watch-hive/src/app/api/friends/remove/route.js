import { getServerUser, createServerClient } from '../../../lib/supabase-server';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * DELETE /api/friends/remove  body: { userId }
 * Remove a friend (unfriend). Deletes the accepted friendship row.
 */
export async function DELETE(req) {
    try {
        const user = await getServerUser();
        if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

        const body = await req.json().catch(() => ({}));
        const friendUserId = body.userId;
        if (!friendUserId) return jsonResponse({ error: 'userId is required' }, 400);
        if (friendUserId === user.id) return jsonResponse({ error: 'Cannot remove yourself' }, 400);

        const supabase = await createServerClient();

        const { data: rows, error: fetchErr } = await supabase
            .from('friends')
            .select('id, status')
            .eq('status', 'accepted')
            .or(`and(user_id.eq.${user.id},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${user.id})`);

        if (fetchErr) throw fetchErr;
        if (!rows?.length) return jsonResponse({ error: 'Not friends with this user' }, 400);

        const { error: deleteErr } = await supabase
            .from('friends')
            .delete()
            .eq('id', rows[0].id);

        if (deleteErr) throw deleteErr;
        return jsonResponse({ success: true });
    } catch (err) {
        console.error('DELETE /api/friends/remove:', err);
        return jsonResponse({ error: 'Failed to remove friend' }, 500);
    }
}
