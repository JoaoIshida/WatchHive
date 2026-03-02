import { getServerUser, createServerClient } from '../../../lib/supabase-server';

/**
 * GET /api/users/search?q=
 * Search profiles by display_name (for add collaborator, etc.)
 * Returns id, display_name, avatar_url. Requires auth. Limit 10.
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
        const q = searchParams.get('q')?.trim() || '';

        if (q.length < 2) {
            return new Response(JSON.stringify({ users: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .neq('id', user.id)
            .ilike('display_name', `%${q}%`)
            .limit(10);

        if (error) throw error;

        const users = (profiles || []).map((p) => ({
            id: p.id,
            display_name: p.display_name || null,
            avatar_url: p.avatar_url || null,
        }));

        return new Response(JSON.stringify({ users }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error searching users:', error);
        return new Response(JSON.stringify({ error: 'Failed to search users' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
