import { createServerClient } from '../../lib/supabase-server';
import { attachPostersToListSummaries } from '../../lib/social-profile-posters';
import { getMockPublicListSearchSummaries } from '../../utils/mockPublicLists';
import { isLocalhostRequest } from '../../utils/mockUser';

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

        const listRows = lists || [];
        const listIds = listRows.map((l) => l.id);
        let itemsCounts = {};
        if (listIds.length > 0) {
            const { data: countRows } = await supabase
                .from('custom_list_items')
                .select('list_id')
                .in('list_id', listIds);
            (countRows || []).forEach((row) => {
                itemsCounts[row.list_id] = (itemsCounts[row.list_id] || 0) + 1;
            });
        }
        const summaries = listRows.map((l) => ({
            ...l,
            items_count: itemsCounts[l.id] || 0,
        }));
        let listsWithPosters = await attachPostersToListSummaries(supabase, summaries);

        if (isLocalhostRequest(req)) {
            const mockLists = getMockPublicListSearchSummaries(query);
            const seen = new Set(listsWithPosters.map((l) => l.id));
            listsWithPosters = [
                ...mockLists.filter((m) => !seen.has(m.id)),
                ...listsWithPosters,
            ];
        }

        return new Response(
            JSON.stringify({
                lists: listsWithPosters,
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
