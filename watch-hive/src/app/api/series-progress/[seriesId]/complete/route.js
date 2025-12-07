import { getServerUser, createServerClient } from '../../../../lib/supabase-server';
import { fetchTMDB } from '../../../utils';

/**
 * Check if an episode is released (server-side validation)
 */
function isEpisodeReleased(episode) {
    if (!episode || !episode.air_date) return false;
    
    try {
        const releaseDate = new Date(episode.air_date);
        releaseDate.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return releaseDate <= today;
    } catch (error) {
        return false;
    }
}

/**
 * Check if a season is released
 */
function isSeasonReleased(season) {
    if (!season || !season.air_date) return false;
    
    try {
        const releaseDate = new Date(season.air_date);
        releaseDate.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return releaseDate <= today;
    } catch (error) {
        return false;
    }
}

/**
 * POST /api/series-progress/[seriesId]/complete
 * Mark entire series as completed or uncompleted
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
        const { completed, seasonsData } = body;

        if (completed === undefined) {
            return new Response(JSON.stringify({ error: 'completed is required' }), {
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
                    completed: completed,
                    last_watched: new Date().toISOString(),
                })
                .select()
                .single();

            if (createError) throw createError;
            seriesProgress = newProgress;
        } else if (progressError) {
            throw progressError;
        }

        // Update series completion status
        const { error: updateError } = await supabase
            .from('series_progress')
            .update({
                completed: completed,
                last_watched: new Date().toISOString(),
            })
            .eq('id', seriesProgress.id);

        if (updateError) throw updateError;

        // Sync with watched_content table
        if (completed) {
            // Mark series as watched in watched_content
            const { data: existingWatched } = await supabase
                .from('watched_content')
                .select('*')
                .eq('user_id', user.id)
                .eq('content_id', parseInt(seriesId))
                .eq('media_type', 'tv')
                .single();

            if (!existingWatched) {
                // Insert new watched record
                await supabase
                    .from('watched_content')
                    .insert({
                        user_id: user.id,
                        content_id: parseInt(seriesId),
                        media_type: 'tv',
                        date_watched: new Date().toISOString(),
                        times_watched: 1,
                    });
            } else {
                // Update existing watched record
                await supabase
                    .from('watched_content')
                    .update({
                        date_watched: new Date().toISOString(),
                    })
                    .eq('id', existingWatched.id);
            }
        } else {
            // Unmark series from watched_content
            await supabase
                .from('watched_content')
                .delete()
                .eq('user_id', user.id)
                .eq('content_id', parseInt(seriesId))
                .eq('media_type', 'tv');
        }

        // If marking as completed, fetch all seasons and filter only released episodes
        if (completed) {
            try {
                // Fetch series details to get all seasons
                const seriesData = await fetchTMDB(`/tv/${seriesId}`, { language: 'en-CA' });
                const allSeasons = seriesData?.seasons || [];
                
                // Process each season
                for (const seasonInfo of allSeasons) {
                    const seasonNumber = seasonInfo.season_number;
                    
                    // Skip unreleased seasons
                    if (!isSeasonReleased(seasonInfo)) {
                        continue;
                    }
                    
                    // Fetch season details to get episodes
                    const seasonData = await fetchTMDB(`/tv/${seriesId}/season/${seasonNumber}`, {
                        language: 'en-CA',
                    });
                    
                    // Filter only released episodes
                    const releasedEpisodes = (seasonData?.episodes || []).filter(ep => isEpisodeReleased(ep));
                    
                    if (releasedEpisodes.length === 0) {
                        continue; // Skip seasons with no released episodes
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
                                completed: true,
                            })
                            .select()
                            .single();

                        if (createSeasonError) throw createSeasonError;
                        season = newSeason;
                    } else if (seasonError) {
                        throw seasonError;
                    } else {
                        // Update existing season to completed
                        await supabase
                            .from('series_seasons')
                            .update({ completed: true })
                            .eq('id', season.id);
                    }

                    // Mark only released episodes as watched
                    // Delete existing episodes first
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
                }
            } catch (error) {
                console.error('Error fetching seasons/episodes:', error);
                // If seasonsData was provided in the request, use it as fallback
                if (seasonsData && typeof seasonsData === 'object') {
                    for (const [seasonNumStr, seasonData] of Object.entries(seasonsData)) {
                        const seasonNumber = parseInt(seasonNumStr);
                        
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
                                    completed: true,
                                })
                                .select()
                                .single();

                            if (createSeasonError) throw createSeasonError;
                            season = newSeason;
                        } else if (seasonError) {
                            throw seasonError;
                        } else {
                            await supabase
                                .from('series_seasons')
                                .update({ completed: true })
                                .eq('id', season.id);
                        }

                        // Mark episodes (assuming they're already filtered by frontend)
                        if (seasonData.episodes && Array.isArray(seasonData.episodes) && seasonData.episodes.length > 0) {
                            await supabase
                                .from('series_episodes')
                                .delete()
                                .eq('series_season_id', season.id);

                            const episodeInserts = seasonData.episodes.map(ep => ({
                                series_season_id: season.id,
                                episode_number: typeof ep === 'number' ? ep : ep.episode_number,
                                watched_at: new Date().toISOString(),
                            }));

                            const { error: episodesError } = await supabase
                                .from('series_episodes')
                                .insert(episodeInserts);

                            if (episodesError) throw episodesError;
                        }
                    }
                }
            }
        } else if (!completed) {
            // If unmarking completion, clear all episodes and mark all seasons as incomplete
            // Get all seasons
            const { data: seasons } = await supabase
                .from('series_seasons')
                .select('id')
                .eq('series_progress_id', seriesProgress.id);

            if (seasons && seasons.length > 0) {
                const seasonIds = seasons.map(s => s.id);
                // Delete all episodes
                await supabase
                    .from('series_episodes')
                    .delete()
                    .in('series_season_id', seasonIds);
            }
            
            // Mark all seasons as incomplete
            await supabase
                .from('series_seasons')
                .update({ completed: false })
                .eq('series_progress_id', seriesProgress.id);
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error updating series completion:', error);
        return new Response(JSON.stringify({ error: 'Failed to update series completion' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

