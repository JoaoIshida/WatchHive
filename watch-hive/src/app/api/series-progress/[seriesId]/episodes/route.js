import { getServerUser, createServerClient } from '../../../../lib/supabase-server';

/**
 * POST /api/series-progress/[seriesId]/episodes
 * Mark episode as watched or unwatched
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
        const { seasonNumber, episodeNumber, watched } = body;

        if (seasonNumber === undefined || episodeNumber === undefined || watched === undefined) {
            return new Response(JSON.stringify({ error: 'seasonNumber, episodeNumber, and watched are required' }), {
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
            // Create new series progress
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
            // Create new season
            const { data: newSeason, error: createSeasonError } = await supabase
                .from('series_seasons')
                .insert({
                    series_progress_id: seriesProgress.id,
                    season_number: seasonNumber,
                    completed: false,
                })
                .select()
                .single();

            if (createSeasonError) throw createSeasonError;
            season = newSeason;
        } else if (seasonError) {
            throw seasonError;
        }

        // If unmarking season completion, do that first
        if (season.completed && !watched) {
            await supabase
                .from('series_seasons')
                .update({ completed: false })
                .eq('id', season.id);
        }

        // Handle episode
        if (watched) {
            // Check if episode already exists
            const { data: existingEpisode } = await supabase
                .from('series_episodes')
                .select('*')
                .eq('series_season_id', season.id)
                .eq('episode_number', episodeNumber)
                .single();

            if (!existingEpisode) {
                // Insert new episode
                const { error: episodeError } = await supabase
                    .from('series_episodes')
                    .insert({
                        series_season_id: season.id,
                        episode_number: episodeNumber,
                        watched_at: new Date().toISOString(),
                    });

                if (episodeError) throw episodeError;
            }
        } else {
            // Remove episode
            const { error: deleteError } = await supabase
                .from('series_episodes')
                .delete()
                .eq('series_season_id', season.id)
                .eq('episode_number', episodeNumber);

            if (deleteError) throw deleteError;
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
        console.error('Error updating episode:', error);
        return new Response(JSON.stringify({ error: 'Failed to update episode' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

