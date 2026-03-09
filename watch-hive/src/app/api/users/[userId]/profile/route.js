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

        if (visibility === 'friends') {
            if (!caller?.id) {
                return new Response(JSON.stringify({ error: 'Sign in to view this profile' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (caller.id !== userId) {
                // Check friendship via the `friends` table from schema.sql
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
            }
        }

        return new Response(
            JSON.stringify({
                id: profile.id,
                display_name: profile.display_name,
                avatar_url: profile.avatar_url,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (err) {
        console.error('GET /api/users/[userId]/profile:', err);
        return new Response(JSON.stringify({ error: 'Failed to load profile' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
