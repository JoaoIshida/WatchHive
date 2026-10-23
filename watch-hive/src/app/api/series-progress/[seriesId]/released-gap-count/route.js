import { getServerUser, createServerClient } from '../../../../lib/supabase-server';
import { after } from 'next/server';
import { computeReleasedGapBatch } from '../../../../lib/releasedGapProgress';

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

        const stats = (await computeReleasedGapBatch(supabase, user.id, [seriesIdStr], { defer: after }))[seriesIdStr];
        if (stats?.error) throw new Error('released total unavailable');

        return new Response(JSON.stringify(stats), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
        });
    } catch (error) {
        console.error('Error counting released gaps:', error);
        return new Response(JSON.stringify({ error: 'Failed to count gaps' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
