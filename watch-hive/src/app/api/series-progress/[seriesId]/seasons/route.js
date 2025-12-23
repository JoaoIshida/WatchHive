import { getServerUser, createServerClient } from '../../../../lib/supabase-server';
import { fetchTMDB } from '../../../utils';

/**
 * Check if an episode is released (server-side validation)
 * If episode has no air_date, falls back to season air_date
 * If neither has a date, allows marking (assumes released since it exists in TMDB)
 */
function isEpisodeReleased(episode, seasonData = null) {
    if (!episode) return false;
    
    // Try episode air_date first
    let airDate = episode.air_date;
    
    // If episode has no air_date, try season air_date as fallback
    if (!airDate && seasonData && seasonData.air_date) {
        airDate = seasonData.air_date;
    }
    
    // If still no date, allow marking (assume released since it exists in TMDB)
    if (!airDate) {
        return true;
    }
    
    try {
        const releaseDate = new Date(airDate);
        releaseDate.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return releaseDate <= today;
    } catch (error) {
        // If date parsing fails, allow marking (assume released)
        return true;
    }
}

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

        // If marking as completed, fetch season episodes and filter only released ones
        if (completed) {
            try {
                // Fetch season details from TMDB to get all episodes
                const seasonData = await fetchTMDB(`/tv/${seriesId}/season/${seasonNumber}`, {
                    language: 'en-CA',
                });
                
                // Filter only released episodes, passing seasonData for fallback date checking
                const releasedEpisodes = (seasonData?.episodes || []).filter(ep => isEpisodeReleased(ep, seasonData));
                
                if (releasedEpisodes.length > 0) {
                    // Delete existing episodes for this season first
                    await supabase
                        .from('series_episodes')
                        .delete()
                        .eq('series_season_id', season.id);

                    // Insert only released episodes
                    const episodeInserts = releasedEpisodes.map(ep => ({
                        series_season_id: season.id,
                        episode_number: ep.episode_number,
                        watched_at: new Date().toISOString(),
                    }));

                    const { error: episodesError } = await supabase
                        .from('series_episodes')
                        .insert(episodeInserts);

                    if (episodesError) throw episodesError;
                    
                    // Mark season as completed (even if there are unreleased episodes)
                    // Only released episodes are marked as watched, so percentage may be < 100%
                    const { error: updateError } = await supabase
                        .from('series_seasons')
                        .update({ completed: true })
                        .eq('id', season.id);

                    if (updateError) throw updateError;
                } else {
                    // No released episodes, don't mark as completed
                    const { error: updateError } = await supabase
                        .from('series_seasons')
                        .update({ completed: false })
                        .eq('id', season.id);

                    if (updateError) throw updateError;
                }
            } catch (error) {
                console.error('Error fetching season episodes:', error);
                // If we can't fetch episodes, still update the completion status
                // but don't mark episodes (they'll be marked individually)
                const { error: updateError } = await supabase
                    .from('series_seasons')
                    .update({ completed: completed })
                    .eq('id', season.id);

                if (updateError) throw updateError;
            }
        } else {
            // If unmarking completion, delete all episodes for this season
            // This removes all episodes that were marked when the season was completed
            const { error: deleteEpisodesError } = await supabase
                .from('series_episodes')
                .delete()
                .eq('series_season_id', season.id);

            if (deleteEpisodesError) {
                console.error('Error deleting episodes when unmarking season:', deleteEpisodesError);
                throw deleteEpisodesError;
            }

            // Update the season status to not completed
            const { error: updateError } = await supabase
                .from('series_seasons')
                .update({ completed: false })
                .eq('id', season.id);

            if (updateError) {
                console.error('Error updating season status when unmarking:', updateError);
                throw updateError;
            }
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

