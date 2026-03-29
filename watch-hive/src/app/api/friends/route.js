import { getServerUser, createServerClient } from '../../lib/supabase-server';
import { notifyFriendRequestReceived } from '../../lib/friend-request-notify';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * GET /api/friends
 * Uses the `friends` table (user_id, friend_id, status: pending|accepted|blocked).
 * The sender of a request is `user_id`; receiver is `friend_id`.
 *
 * Returns { friends, pendingReceived, pendingSent }
 */
export async function GET() {
    try {
        const user = await getServerUser();
        if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

        const supabase = await createServerClient();

        const { data: rows, error: reqError } = await supabase
            .from('friends')
            .select('id, user_id, friend_id, status, created_at')
            .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        if (reqError) throw reqError;

        const friends = [];
        const pendingReceived = [];
        const pendingSent = [];
        const otherUserIds = new Set();

        for (const r of rows || []) {
            const otherId = r.user_id === user.id ? r.friend_id : r.user_id;

            if (r.status === 'accepted') {
                otherUserIds.add(otherId);
                friends.push({ requestId: r.id, userId: otherId, createdAt: r.created_at });
            } else if (r.status === 'pending') {
                otherUserIds.add(otherId);
                if (r.friend_id === user.id) {
                    // Current user is the receiver
                    pendingReceived.push({ requestId: r.id, senderId: r.user_id, createdAt: r.created_at });
                } else {
                    // Current user is the sender
                    pendingSent.push({ requestId: r.id, receiverId: r.friend_id, createdAt: r.created_at });
                }
            }
        }

        // Fetch display names for all referenced users
        if (otherUserIds.size === 0) {
            return jsonResponse({ friends: [], pendingReceived: [], pendingSent: [] });
        }

        const { data: profiles, error: profError } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', [...otherUserIds]);

        if (profError) throw profError;
        const profileMap = {};
        (profiles || []).forEach((p) => (profileMap[p.id] = p));

        const enrich = (list, idKey) =>
            list.map((item) => {
                const id = item[idKey] || item.userId;
                const p = profileMap[id];
                return { ...item, display_name: p?.display_name ?? null, avatar_url: p?.avatar_url ?? null };
            });

        return jsonResponse({
            friends: enrich(friends, 'userId'),
            pendingReceived: enrich(pendingReceived, 'senderId'),
            pendingSent: enrich(pendingSent, 'receiverId'),
        });
    } catch (err) {
        console.error('GET /api/friends:', err);
        return jsonResponse({ error: 'Failed to load friends' }, 500);
    }
}

/**
 * POST /api/friends  body: { displayName } and/or { userId }
 * Usernames are unique case-insensitively. Prefer sending displayName from search results;
 * userId is optional and must match the resolved name when both are sent.
 */
export async function POST(req) {
    try {
        const user = await getServerUser();
        if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

        const body = await req.json().catch(() => ({}));
        const displayName =
            typeof body.displayName === 'string' ? body.displayName.trim() : '';
        let targetUserId = body.userId || null;

        const supabase = await createServerClient();

        if (displayName.length >= 2) {
            const { data: resolvedId, error: rpcErr } = await supabase.rpc('profile_id_for_display_name', {
                p_name: displayName,
            });
            if (rpcErr) throw rpcErr;
            if (!resolvedId) {
                return jsonResponse({ error: 'No user found with that username' }, 404);
            }
            if (targetUserId && targetUserId !== resolvedId) {
                return jsonResponse({ error: 'Username does not match that profile' }, 400);
            }
            targetUserId = resolvedId;
        } else if (!targetUserId) {
            return jsonResponse(
                { error: 'Send displayName (username, 2+ characters) or userId' },
                400,
            );
        }

        if (targetUserId === user.id) return jsonResponse({ error: 'Cannot send request to yourself' }, 400);

        // Check for existing row in either direction
        const { data: existingRows, error: existErr } = await supabase
            .from('friends')
            .select('id, status, user_id')
            .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`);

        if (existErr) throw existErr;

        if (existingRows?.length) {
            const ex = existingRows[0];
            if (ex.status === 'accepted') return jsonResponse({ error: 'Already friends' }, 400);
            if (ex.status === 'pending') {
                return jsonResponse({
                    error: ex.user_id === user.id ? 'Request already sent' : 'They already sent you a request — check your received requests',
                }, 400);
            }
        }

        const { data: inserted, error } = await supabase
            .from('friends')
            .insert({ user_id: user.id, friend_id: targetUserId, status: 'pending' })
            .select('id, created_at')
            .single();

        if (error) throw error;

        try {
            await notifyFriendRequestReceived(supabase, {
                senderId: user.id,
                receiverId: targetUserId,
            });
        } catch (notifyErr) {
            console.error('notifyFriendRequestReceived:', notifyErr);
        }

        return jsonResponse({ requestId: inserted.id, createdAt: inserted.created_at });
    } catch (err) {
        console.error('POST /api/friends:', err);
        return jsonResponse({ error: 'Failed to send friend request' }, 500);
    }
}
