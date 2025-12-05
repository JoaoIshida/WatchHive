import { getServerUser, createServerClient } from '../../../lib/supabase-server';

/**
 * GET /api/user/stats
 * Get user statistics using the get_user_stats() database function
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

        const supabase = await createServerClient();

        // Call the get_user_stats database function
        const { data, error } = await supabase.rpc('get_user_stats', {
            p_user_id: user.id
        });

        if (error) throw error;

        // The function returns an array with one row
        const stats = data && data.length > 0 ? data[0] : {
            watched_count: 0,
            wishlist_count: 0,
            series_in_progress: 0,
            completed_series: 0,
            total_episodes_watched: 0,
            custom_lists_count: 0
        };

        return new Response(JSON.stringify({ stats }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch user stats' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
