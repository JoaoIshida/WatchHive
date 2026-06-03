import { getServerUser, createServerClient } from '../../../lib/supabase-server';
import { computeReleasedGapBatch } from '../../../lib/releasedGapProgress';

const MAX_SERIES_IDS = 30;

/**
 * POST /api/series-progress/released-gap-counts
 * Body: { seriesIds: string[] }
 * Returns: { [seriesId]: { count, watched, releasedTotal } | { error: true } }
 */
export async function POST(req) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let body;
        try {
            body = await req.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const rawIds = Array.isArray(body?.seriesIds) ? body.seriesIds : [];
        const seriesIds = [...new Set(rawIds.map((id) => String(id)).filter(Boolean))].slice(
            0,
            MAX_SERIES_IDS,
        );

        if (seriesIds.length === 0) {
            return new Response(JSON.stringify({}), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        const results = await computeReleasedGapBatch(supabase, user.id, seriesIds);

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        console.error('Error batch counting released gaps:', error);
        return new Response(JSON.stringify({ error: 'Failed to count gaps' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
