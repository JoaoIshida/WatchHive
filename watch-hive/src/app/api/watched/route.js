import { getServerUser, createServerClient } from '../../lib/supabase-server';
import { fetchTMDB } from '../utils';

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
        const { data: watched, error } = await supabase
            .from('watched_content')
            .select('*')
            .eq('user_id', user.id)
            .order('date_watched', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ watched: watched || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching watched items:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch watched items' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function POST(req) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await req.json();
        const { itemId, mediaType, dateWatched } = body;

        if (!itemId || !mediaType) {
            return new Response(JSON.stringify({ error: 'itemId and mediaType are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        
        // Check if already exists
        const { data: existing } = await supabase
            .from('watched_content')
            .select('*')
            .eq('user_id', user.id)
            .eq('content_id', itemId)
            .eq('media_type', mediaType)
            .single();

        let result;
        if (existing) {
            // Update existing record - increment times_watched
            const { data, error } = await supabase
                .from('watched_content')
                .update({
                    times_watched: existing.times_watched + 1,
                    date_watched: dateWatched || new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        } else {
            // Insert new record
            const { data, error } = await supabase
                .from('watched_content')
                .insert({
                    user_id: user.id,
                    content_id: itemId,
                    media_type: mediaType,
                    date_watched: dateWatched || new Date().toISOString(),
                    times_watched: 1,
                })
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        }

        // If it's a series, also mark all released episodes as watched in series_progress
        if (mediaType === 'tv') {
            try {
                // Fetch series details to get seasons
                const seriesData = await fetchTMDB(`/tv/${itemId}`, { language: 'en-CA' });
                const seasons = seriesData?.seasons || [];
                
                // Get or create series progress
                let { data: seriesProgress, error: progressError } = await supabase
                    .from('series_progress')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('series_id', parseInt(itemId))
                    .single();

                if (progressError && progressError.code === 'PGRST116') {
                    const { data: newProgress, error: createError } = await supabase
                        .from('series_progress')
                        .insert({
                            user_id: user.id,
                            series_id: parseInt(itemId),
                            completed: true,
                            last_watched: new Date().toISOString(),
                        })
                        .select()
                        .single();

                    if (createError) throw createError;
                    seriesProgress = newProgress;
                } else if (progressError) {
                    throw progressError;
                } else {
                    // Update existing progress to completed
                    await supabase
                        .from('series_progress')
                        .update({
                            completed: true,
                            last_watched: new Date().toISOString(),
                        })
                        .eq('id', seriesProgress.id);
                }

                // Fetch all seasons and mark released episodes
                const allSeasonsData = {};
                for (const season of seasons) {
                    // Check if season is released
                    const seasonAirDate = season.air_date;
                    if (seasonAirDate) {
                        const releaseDate = new Date(seasonAirDate);
                        releaseDate.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        if (releaseDate > today) {
                            continue; // Skip unreleased seasons
                        }
                    }

                    try {
                        const seasonData = await fetchTMDB(`/tv/${itemId}/season/${season.season_number}`, {
                            language: 'en-CA',
                        });
                        
                        // Filter only released episodes
                        const releasedEpisodes = (seasonData?.episodes || []).filter(ep => isEpisodeReleased(ep));
                        
                        if (releasedEpisodes.length > 0) {
                            allSeasonsData[season.season_number] = {
                                ...seasonData,
                                episodes: releasedEpisodes
                            };
                        }
                    } catch (error) {
                        console.error(`Error fetching season ${season.season_number}:`, error);
                    }
                }

                // Mark all released episodes in series_progress
                if (Object.keys(allSeasonsData).length > 0) {
                    for (const [seasonNumStr, seasonData] of Object.entries(allSeasonsData)) {
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
                            // Update existing season to completed
                            await supabase
                                .from('series_seasons')
                                .update({ completed: true })
                                .eq('id', season.id);
                        }

                        // Mark all released episodes as watched
                        if (seasonData.episodes && Array.isArray(seasonData.episodes) && seasonData.episodes.length > 0) {
                            // Delete existing episodes for this season first
                            await supabase
                                .from('series_episodes')
                                .delete()
                                .eq('series_season_id', season.id);

                            // Insert all released episodes
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
            } catch (error) {
                console.error('Error syncing series progress:', error);
                // Don't fail the watched operation if series progress sync fails
            }
        }

        return new Response(JSON.stringify({ watched: result, success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error adding watched item:', error);
        return new Response(JSON.stringify({ error: 'Failed to add watched item' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function DELETE(req) {
    try {
        const user = await getServerUser();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { searchParams } = new URL(req.url, 'http://localhost');
        const itemId = searchParams.get('itemId');
        const mediaType = searchParams.get('mediaType');

        if (!itemId || !mediaType) {
            return new Response(JSON.stringify({ error: 'itemId and mediaType are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = await createServerClient();
        const { error } = await supabase
            .from('watched_content')
            .delete()
            .eq('user_id', user.id)
            .eq('content_id', itemId)
            .eq('media_type', mediaType);

        if (error) throw error;

        // If it's a series, also clear series progress
        if (mediaType === 'tv') {
            try {
                // Get series progress
                const { data: seriesProgress } = await supabase
                    .from('series_progress')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('series_id', parseInt(itemId))
                    .single();

                if (seriesProgress) {
                    // Get all seasons for this series progress
                    const { data: seasons } = await supabase
                        .from('series_seasons')
                        .select('id')
                        .eq('series_progress_id', seriesProgress.id);

                    if (seasons && seasons.length > 0) {
                        // Delete all episodes for all seasons
                        const seasonIds = seasons.map(s => s.id);
                        await supabase
                            .from('series_episodes')
                            .delete()
                            .in('series_season_id', seasonIds);

                        // Delete all seasons
                        await supabase
                            .from('series_seasons')
                            .delete()
                            .eq('series_progress_id', seriesProgress.id);
                    }

                    // Delete series progress
                    await supabase
                        .from('series_progress')
                        .delete()
                        .eq('id', seriesProgress.id);
                }
            } catch (error) {
                console.error('Error clearing series progress:', error);
                // Don't fail the watched deletion if series progress clear fails
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error removing watched item:', error);
        return new Response(JSON.stringify({ error: 'Failed to remove watched item' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

