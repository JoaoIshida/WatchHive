import { getServerUser, createServerClient } from '../../../../lib/supabase-server';

/**
 * GET /api/users/[userId]/profile
 * Returns a user's public profile if visibility allows.
 * Visibility is stored in profiles.preferences->>'profile_visibility'.
 * - no_one: 404
 * - friends: 200 only if caller is friend (uses `friends` table)
 * - anyone (default): 200
 */
export async function GET(req, { params }) {
    try {
        const { userId } = await params;
        if (!userId) {
            return new Response(JSON.stringify({ error: 'User ID required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        const caller = await getServerUser();

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, preferences')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: 'Profile not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const visibility = profile.preferences?.profile_visibility || 'anyone';

        if (visibility === 'no_one') {
            return new Response(JSON.stringify({ error: 'Profile is private' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let isFriend = false;
        if (visibility === 'friends') {
            if (!caller?.id) {
                return new Response(JSON.stringify({ error: 'Sign in to view this profile' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (caller.id !== userId) {
                const { data: friendRows } = await supabase
                    .from('friends')
                    .select('id')
                    .eq('status', 'accepted')
                    .or(`and(user_id.eq.${caller.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${caller.id})`);
                if (!friendRows?.length) {
                    return new Response(JSON.stringify({ error: 'Profile is only visible to friends' }), {
                        status: 403,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                isFriend = true;
            } else {
                isFriend = true;
            }
        } else if (caller?.id && caller.id !== userId) {
            const { data: friendRows } = await supabase
                .from('friends')
                .select('id')
                .eq('status', 'accepted')
                .or(`and(user_id.eq.${caller.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${caller.id})`);
            isFriend = !!friendRows?.length;
        }

        const payload = {
            id: profile.id,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
        };

        const { data: watchedRows } = await supabase
            .from('watched_content')
            .select('media_type')
            .eq('user_id', userId);
        const watchedMovies = (watchedRows || []).filter((r) => r.media_type === 'movie').length;
        const watchedSeries = (watchedRows || []).filter((r) => r.media_type === 'tv').length;
        payload.watched_summary = {
            total: (watchedRows || []).length,
            movies: watchedMovies,
            series: watchedSeries,
        };

        const { data: publicLists } = await supabase
            .from('custom_lists')
            .select('id, name')
            .eq('user_id', userId)
            .eq('is_public', true);
        const listIds = (publicLists || []).map((l) => l.id);
        let itemsCounts = {};
        if (listIds.length > 0) {
            const { data: counts } = await supabase
                .from('custom_list_items')
                .select('list_id')
                .in('list_id', listIds);
            (counts || []).forEach((row) => {
                itemsCounts[row.list_id] = (itemsCounts[row.list_id] || 0) + 1;
            });
        }
        payload.public_lists = (publicLists || []).map((l) => ({
            id: l.id,
            name: l.name,
            items_count: itemsCounts[l.id] || 0,
        }));

        if (caller?.id && isFriend && caller.id !== userId) {
            const { data: sharedLists } = await supabase
                .from('list_collaborators')
                .select('list_id')
                .eq('user_id', caller.id);
            const sharedListIds = (sharedLists || []).map((s) => s.list_id).filter(Boolean);
            if (sharedListIds.length > 0) {
                const { data: lists } = await supabase
                    .from('custom_lists')
                    .select('id, name')
                    .eq('user_id', userId)
                    .in('id', sharedListIds);
                const sharedIds = (lists || []).map((l) => l.id);
                let sharedCounts = {};
                if (sharedIds.length > 0) {
                    const { data: countRows } = await supabase
                        .from('custom_list_items')
                        .select('list_id')
                        .in('list_id', sharedIds);
                    (countRows || []).forEach((row) => {
                        sharedCounts[row.list_id] = (sharedCounts[row.list_id] || 0) + 1;
                    });
                }
                payload.shared_with_you = (lists || []).map((l) => ({
                    id: l.id,
                    name: l.name,
                    items_count: sharedCounts[l.id] || 0,
                }));
            } else {
                payload.shared_with_you = [];
            }
        }

        return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('GET /api/users/[userId]/profile:', err);
        return new Response(JSON.stringify({ error: 'Failed to load profile' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
