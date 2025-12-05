import { getServerUser, createServerClient } from '../../lib/supabase-server';

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
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get all seasons for all series
        const progressIds = allProgress.map(p => p.id);
        const { data: allSeasons, error: seasonsError } = await supabase
            .from('series_seasons')
            .select('*')
            .in('series_progress_id', progressIds)
            .order('season_number', { ascending: true });

        if (seasonsError) throw seasonsError;

        // Get all episodes for all seasons
        const seasonIds = allSeasons.map(s => s.id);
        let allEpisodes = [];
        if (seasonIds.length > 0) {
            const { data: episodesData, error: episodesError } = await supabase
                .from('series_episodes')
                .select('*')
                .in('series_season_id', seasonIds)
                .order('episode_number', { ascending: true });

            if (episodesError) throw episodesError;
            allEpisodes = episodesData || [];
        }

        // Build response structure matching localStorage format
        const progressMap = {};
        allProgress.forEach(progress => {
            const seasonsForProgress = allSeasons.filter(s => s.series_progress_id === progress.id);
            const seasonsMap = {};

            seasonsForProgress.forEach(season => {
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
                lastWatched: progress.last_watched
            };
        });

        return new Response(JSON.stringify(progressMap), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching all series progress:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch series progress' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

