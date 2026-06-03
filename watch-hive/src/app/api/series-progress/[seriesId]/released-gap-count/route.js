import { getServerUser, createServerClient } from '../../../../lib/supabase-server';
import {
    computeReleasedGapForSeries,
    loadWatchedEpisodesBySeries,
} from '../../../../lib/releasedGapProgress';

/**
 * GET /api/series-progress/[seriesId]/released-gap-count
 * Count of released episodes not yet marked (regular seasons only).
 */
export async function GET(req, { params }) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { seriesId } = await params;
        const seriesIdStr = String(seriesId);
        const supabase = await createServerClient();

        const watchedBySeries = await loadWatchedEpisodesBySeries(supabase, user.id, [
            seriesIdStr,
        ]);
        const stats = await computeReleasedGapForSeries(
            seriesIdStr,
            watchedBySeries.get(seriesIdStr) || new Map(),
        );

        return new Response(JSON.stringify(stats), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error counting released gaps:', error);
        return new Response(JSON.stringify({ error: 'Failed to count gaps' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
