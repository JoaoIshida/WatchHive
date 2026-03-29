import { getServerUser, createServerClient } from '../../../lib/supabase-server';

const SELECT_FIELDS = 'id, display_name, avatar_url';
const MIN_QUERY_LEN = 3;
const MAX_QUERY_LEN = 32;
const MAX_RESULTS = 8;

/** Escape `%`, `_`, `\` for PostgreSQL LIKE (default escape `\`). */
function escapeLikePattern(s) {
    return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * GET /api/users/search?q=
 * Case-sensitive prefix match on display_name only (no substring / no hex tags).
 * Reduces scraping: must know how the username starts, exact casing.
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
        const raw = searchParams.get('q')?.trim() || '';

        if (raw.length < MIN_QUERY_LEN) {
            return new Response(JSON.stringify({ users: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (raw.length > MAX_QUERY_LEN) {
            return new Response(JSON.stringify({ error: 'Query too long' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        const pattern = `${escapeLikePattern(raw)}%`;

        const { data: nameRows, error: nameErr } = await supabase
            .from('profiles')
            .select(SELECT_FIELDS)
            .neq('id', user.id)
            .like('display_name', pattern)
            .order('display_name', { ascending: true })
            .limit(MAX_RESULTS);

        if (nameErr) throw nameErr;

        const users = (nameRows || []).map((p) => ({
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
