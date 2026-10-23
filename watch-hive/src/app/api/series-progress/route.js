import { getServerUser, createServerClient, selectAllPages } from '../../lib/supabase-server';

/**
 * GET /api/series-progress
 * Get all series progress for the authenticated user
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

        // Get all series progress
        const { data: allProgress, error: progressError } = await supabase
            .from('series_progress')
            .select('*')
            .eq('user_id', user.id)
            .order('last_watched', { ascending: false });

        if (progressError) throw progressError;

        if (!allProgress || allProgress.length === 0) {
            return new Response(JSON.stringify({}), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'private, no-store',
                },
            });
        }

        // Get all seasons for all series
        const progressIds = allProgress.map(p => p.id);
        // Paged: a single select caps at 1000 rows, which dropped half of large watch histories.
        const allSeasons = await selectAllPages(() =>
            supabase
                .from('series_seasons')
                .select('*')
                .in('series_progress_id', progressIds)
                .order('season_number', { ascending: true })
                .order('id', { ascending: true }),
        );

        // Get all episodes for all seasons
        const seasonIds = allSeasons.map(s => s.id);
        let allEpisodes = [];
        if (seasonIds.length > 0) {
            allEpisodes = await selectAllPages(() =>
                supabase
                    .from('series_episodes')
                    .select('series_season_id, episode_number')
                    .in('series_season_id', seasonIds)
                    .order('episode_number', { ascending: true })
                    .order('id', { ascending: true }),
            );
        }

        // Build response structure matching localStorage format
        const progressMap = {};
        allProgress.forEach(progress => {
            const seasonsForProgress = allSeasons.filter(s => s.series_progress_id === progress.id);
            const seasonsMap = {};

            seasonsForProgress.forEach(season => {
                if (season.season_number <= 0) return;

                const seasonEpisodes = allEpisodes
                    .filter(ep => ep.series_season_id === season.id)
                    .map(ep => ep.episode_number)
                    .sort((a, b) => a - b);

                seasonsMap[season.season_number] = {
                    episodes: seasonEpisodes,
                    completed: season.completed
                };
            });

            progressMap[progress.series_id] = {
                seasons: seasonsMap,
                completed: progress.completed,
                lastWatched: progress.last_watched,
                catalogTotalEpisodes: progress.catalog_total_episodes ?? null,
                catalogRefreshedAt: progress.catalog_refreshed_at ?? null,
            };
        });

        return new Response(JSON.stringify(progressMap), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        console.error('Error fetching all series progress:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch series progress' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

