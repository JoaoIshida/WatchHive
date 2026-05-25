import { fetchTMDB } from '../api/utils';
import {
    getMockListPosterPaths,
    isMockListId,
    LIST_PREVIEW_POSTER_LIMIT,
} from '../utils/mockPublicLists';

/** Server: poster paths for list summary rows (mock lists or TMDB for real lists). */
export async function attachPostersToListSummaries(supabase, lists) {
    return Promise.all(
        (lists || []).map(async (list) => {
            if (isMockListId(list.id)) {
                return { ...list, posters: getMockListPosterPaths(list.id) };
            }
            const { data: items } = await supabase
                .from('custom_list_items')
                .select('content_id, media_type')
                .eq('list_id', list.id)
                .order('date_added', { ascending: false })
                .limit(LIST_PREVIEW_POSTER_LIMIT);
            const posters = [];
            for (const item of items || []) {
                try {
                    const type = item.media_type === 'movie' ? 'movie' : 'tv';
                    const details = await fetchTMDB(`/${type}/${item.content_id}`, {
                        language: 'en-CA',
                    });
                    if (details?.poster_path) posters.push(details.poster_path);
                } catch {
                    /* skip missing TMDB */
                }
            }
            return { ...list, posters };
        })
    );
}
