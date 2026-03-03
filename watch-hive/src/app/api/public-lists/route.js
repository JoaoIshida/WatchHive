import { createServerClient } from '../../lib/supabase-server';

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url, 'http://localhost');
        const query = searchParams.get('query') || '';
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = 20;
        const offset = (page - 1) * limit;

        const supabase = await createServerClient();

        let dbQuery = supabase
            .from('custom_lists')
            .select('*', { count: 'exact' })
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (query.trim()) {
            const escaped = query.trim().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
            const pattern = `%${escaped}%`;
            dbQuery = dbQuery.or(`name.ilike.${pattern},description.ilike.${pattern}`);
        }

        const { data: lists, error, count } = await dbQuery;

        if (error) throw error;

        return new Response(
            JSON.stringify({
                lists: lists || [],
                total_results: count || 0,
                page,
                total_pages: Math.ceil((count || 0) / limit),
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': CACHE_CONTROL,
                },
            }
        );
    } catch (error) {
        console.error('Error fetching public lists:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch public lists' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
