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

        // If marking as watched, verify the episode exists and is released
        if (watched) {
            try {
                const seasonData = await fetchTMDB(`/tv/${seriesId}/season/${seasonNumber}`, {
                    language: 'en-CA',
                });
                
                const episode = seasonData?.episodes?.find(ep => ep.episode_number === episodeNumber);
                
                // If episode doesn't exist in TMDB, it might not be released yet or doesn't have info
                if (!episode) {
                    return new Response(JSON.stringify({ 
                        error: 'Episode not found in database',
                        message: `Episode ${episodeNumber} of Season ${seasonNumber} is not available in TMDB yet. It may not have been released or may not have complete information.`,
                        episode: {
                            seasonNumber,
                            episodeNumber
                        }
                    }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                
                // Check if episode is released, using season data as fallback for missing dates
                // Episodes without dates are allowed (assumed released since they exist in TMDB)
                if (!isEpisodeReleased(episode, seasonData)) {
                    // Only block if we have a date and it's in the future
                    const hasDate = episode.air_date || (seasonData && seasonData.air_date);
                    if (hasDate) {
                        return new Response(JSON.stringify({ 
                            error: 'Cannot mark unreleased episode as watched',
                            episode: {
                                name: episode.name || `Episode ${episodeNumber}`,
                                air_date: episode.air_date || (seasonData ? seasonData.air_date : null)
                            }
                        }), {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    }
                    // If no date at all, allow marking (assume released)
                }
            } catch (error) {
                console.error('Error validating episode release date:', error);
                // If it's a 404 (not found), provide a helpful message
                if (error.message && error.message.includes('404')) {
                    return new Response(JSON.stringify({ 
                        error: 'Episode not found',
                        message: `Season ${seasonNumber} or episode ${episodeNumber} is not available in TMDB. It may not have been released yet or may not have complete information.`,
                        details: error.message
                    }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                // For other errors, allow marking (assume released) - this handles cases where
                // episodes exist but have incomplete data
                console.warn('Allowing episode marking despite validation error:', error.message);
            }
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

