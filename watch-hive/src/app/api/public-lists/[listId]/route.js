import { createServerClient } from '../../../lib/supabase-server';
import { fetchTMDB } from '../../../api/utils';

export async function GET(req, { params }) {
    try {
        const { listId } = await params;
        const supabase = await createServerClient();

        const { data: list, error: listError } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', listId)
            .eq('is_public', true)
            .single();

        if (listError || !list) {
            return new Response(JSON.stringify({ error: 'List not found or is private' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { data: items, error: itemsError } = await supabase
            .from('custom_list_items')
            .select('*')
            .eq('list_id', listId)
            .order('date_added', { ascending: false });

        if (itemsError) throw itemsError;

        const enrichedItems = await Promise.all(
            (items || []).map(async (item) => {
                try {
                    const type = item.media_type === 'movie' ? 'movie' : 'tv';
                    const details = await fetchTMDB(`/${type}/${item.content_id}`, { language: 'en-CA' });
                    return { ...item, details };
                } catch {
                    return { ...item, details: null };
                }
            })
        );

        return new Response(
            JSON.stringify({ list: { ...list, items: enrichedItems } }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
                },
            }
        );
    } catch (error) {
        console.error('Error fetching public list:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch list' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
