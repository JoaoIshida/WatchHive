import { getServerUser, createServerClient } from '../../../lib/supabase-server';

/**
 * GET /api/series-progress/[seriesId]
 * Get series progress for a specific series
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
        const supabase = await createServerClient();

        // Get series progress
        const { data: seriesProgress, error: progressError } = await supabase
            .from('series_progress')
            .select('*')
            .eq('user_id', user.id)
            .eq('series_id', seriesId)
            .single();

        if (progressError && progressError.code !== 'PGRST116') {
            throw progressError;
        }

        // If no progress exists, return empty structure
        if (!seriesProgress) {
            return new Response(JSON.stringify({
                series_id: parseInt(seriesId),
                completed: false,
                last_watched: null,
                seasons: {}
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get all seasons for this series progress
        const { data: seasons, error: seasonsError } = await supabase
            .from('series_seasons')
            .select('*')
            .eq('series_progress_id', seriesProgress.id)
            .order('season_number', { ascending: true });

        if (seasonsError) throw seasonsError;

        // Get all episodes for all seasons
        const seasonIds = seasons.map(s => s.id);
        let episodes = [];
        if (seasonIds.length > 0) {
            const { data: episodesData, error: episodesError } = await supabase
                .from('series_episodes')
                .select('*')
                .in('series_season_id', seasonIds)
                .order('episode_number', { ascending: true });

            if (episodesError) throw episodesError;
            episodes = episodesData || [];
        }

        // Build the response structure matching localStorage format
        const seasonsMap = {};
        seasons.forEach(season => {
            const seasonEpisodes = episodes
                .filter(ep => ep.series_season_id === season.id)
                .map(ep => ep.episode_number)
                .sort((a, b) => a - b);

            seasonsMap[season.season_number] = {
                episodes: seasonEpisodes,
                completed: season.completed
            };
        });

        return new Response(JSON.stringify({
            series_id: seriesProgress.series_id,
            completed: seriesProgress.completed,
            last_watched: seriesProgress.last_watched,
            seasons: seasonsMap
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching series progress:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch series progress' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

