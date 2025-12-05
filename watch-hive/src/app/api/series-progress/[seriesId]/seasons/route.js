import { getServerUser, createServerClient } from '../../../../lib/supabase-server';

/**
 * POST /api/series-progress/[seriesId]/seasons
 * Mark season as completed or uncompleted
 */
export async function POST(req, { params }) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { seriesId } = await params;
        const body = await req.json();
        const { seasonNumber, completed, episodes } = body;

        if (seasonNumber === undefined || completed === undefined) {
            return new Response(JSON.stringify({ error: 'seasonNumber and completed are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();

        // Get or create series progress
        let { data: seriesProgress, error: progressError } = await supabase
            .from('series_progress')
            .select('*')
            .eq('user_id', user.id)
            .eq('series_id', seriesId)
            .single();

        if (progressError && progressError.code === 'PGRST116') {
            const { data: newProgress, error: createError } = await supabase
                .from('series_progress')
                .insert({
                    user_id: user.id,
                    series_id: parseInt(seriesId),
                    last_watched: new Date().toISOString(),
                })
                .select()
                .single();

            if (createError) throw createError;
            seriesProgress = newProgress;
        } else if (progressError) {
            throw progressError;
        }

        // Get or create season
        let { data: season, error: seasonError } = await supabase
            .from('series_seasons')
            .select('*')
            .eq('series_progress_id', seriesProgress.id)
            .eq('season_number', seasonNumber)
            .single();

        if (seasonError && seasonError.code === 'PGRST116') {
            const { data: newSeason, error: createSeasonError } = await supabase
                .from('series_seasons')
                .insert({
                    series_progress_id: seriesProgress.id,
                    season_number: seasonNumber,
                    completed: completed,
                })
                .select()
                .single();

            if (createSeasonError) throw createSeasonError;
            season = newSeason;
        } else if (seasonError) {
            throw seasonError;
        }

        // Update season completion status
        const { error: updateError } = await supabase
            .from('series_seasons')
            .update({ completed: completed })
            .eq('id', season.id);

        if (updateError) throw updateError;

        // If marking as completed and episodes are provided, mark all episodes as watched
        if (completed && episodes && Array.isArray(episodes) && episodes.length > 0) {
            // Delete existing episodes for this season first
            await supabase
                .from('series_episodes')
                .delete()
                .eq('series_season_id', season.id);

            // Insert all episodes
            const episodeInserts = episodes.map(ep => ({
                series_season_id: season.id,
                episode_number: typeof ep === 'number' ? ep : ep.episode_number,
                watched_at: new Date().toISOString(),
            }));

            const { error: episodesError } = await supabase
                .from('series_episodes')
                .insert(episodeInserts);

            if (episodesError) throw episodesError;
        } else if (!completed) {
            // If unmarking completion, remove all episodes
            await supabase
                .from('series_episodes')
                .delete()
                .eq('series_season_id', season.id);
        }

        // Update last_watched timestamp
        await supabase
            .from('series_progress')
            .update({ last_watched: new Date().toISOString() })
            .eq('id', seriesProgress.id);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error updating season:', error);
        return new Response(JSON.stringify({ error: 'Failed to update season' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

