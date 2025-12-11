import { getServerUser, createServerClient } from '../../lib/supabase-server';
import { fetchTMDB } from '../utils';

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
        // Uses index: idx_watched_content_user_id, idx_watched_content_date_watched
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
        // Uses index: idx_watched_content_user_content_media (composite index for fast lookup)
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

        // Early return for movies - no series processing needed
        if (mediaType === 'movie') {
            return new Response(JSON.stringify({ watched: result, success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // If it's a series, also mark all released episodes as watched in series_progress
        if (mediaType === 'tv') {
            try {
                // Fetch series details to get seasons
                const seriesData = await fetchTMDB(`/tv/${itemId}`, { language: 'en-CA' });
                const seasons = seriesData?.seasons || [];
                
                // Get or create series progress
                // Uses index: idx_series_progress_user_series (composite index for fast lookup)
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
                            completed: true, // Mark as completed since we're marking all released episodes
                            last_watched: new Date().toISOString(),
                        })
                        .select()
                        .single();

                    if (createError) throw createError;
                    seriesProgress = newProgress;
                } else if (progressError) {
                    throw progressError;
                } else {
                    // Update existing progress - mark as completed since we're marking all released episodes
                    await supabase
                        .from('series_progress')
                        .update({
                            completed: true,
                            last_watched: new Date().toISOString(),
                        })
                        .eq('id', seriesProgress.id);
                }

                // OPTIMIZATION: Parallel fetch all seasons with date validation
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // Track skipped content for user feedback
                const skippedSeasons = [];
                const skippedEpisodes = [];
                
                // Filter unreleased seasons BEFORE fetching and fetch all released seasons in parallel
                const seasonPromises = seasons
                    .filter(season => {
                        // Pre-filter: Skip unreleased seasons before making API calls
                        if (season.air_date) {
                            const releaseDate = new Date(season.air_date);
                            releaseDate.setHours(0, 0, 0, 0);
                            if (releaseDate > today) {
                                skippedSeasons.push({
                                    seasonNumber: season.season_number,
                                    seasonName: season.name || `Season ${season.season_number}`,
                                    releaseDate: season.air_date
                                });
                                return false; // Skip unreleased seasons
                            }
                        }
                        return true; // Include released seasons or seasons without air_date
                    })
                    .map(async (season) => {
                        try {
                            // Fetch season details in parallel
                            const seasonData = await fetchTMDB(`/tv/${itemId}/season/${season.season_number}`, {
                                language: 'en-CA',
                            });
                            
                            // Post-filter: Filter only released episodes after fetching
                            // Pass seasonData for fallback date checking
                            const allEpisodes = seasonData?.episodes || [];
                            const releasedEpisodes = allEpisodes.filter(ep => isEpisodeReleased(ep, seasonData));
                            const unreleasedEpisodes = allEpisodes.filter(ep => !isEpisodeReleased(ep, seasonData));
                            
                            // Track skipped episodes
                            unreleasedEpisodes.forEach(ep => {
                                // Handle cases where episode data might be incomplete
                                const episodeNumber = ep.episode_number ?? ep.episodeNumber ?? null;
                                const episodeName = ep.name || 
                                    (episodeNumber !== null ? `Episode ${episodeNumber}` : 'Episode');
                                
                                skippedEpisodes.push({
                                    seasonNumber: season.season_number,
                                    seasonName: seasonData.name || season.name || `Season ${season.season_number}`,
                                    episodeNumber: episodeNumber,
                                    episodeName: episodeName,
                                    releaseDate: ep.air_date || ep.release_date || null
                                });
                            });
                            
                            if (releasedEpisodes.length > 0) {
                                return {
                                    seasonNumber: season.season_number,
                                    seasonData: {
                                        ...seasonData,
                                        episodes: releasedEpisodes // Only released episodes
                                    }
                                };
                            }
                            return null; // No released episodes in this season
                        } catch (error) {
                            console.error(`Error fetching season ${season.season_number}:`, error);
                            return null;
                        }
                    });
                
                // Wait for all season fetches to complete in parallel
                const seasonResults = await Promise.all(seasonPromises);
                const allSeasonsData = {};
                
                // Build seasons data object (only includes seasons with released episodes)
                seasonResults.forEach(result => {
                    if (result && result.seasonData) {
                        allSeasonsData[result.seasonNumber] = result.seasonData;
                    }
                });

                // OPTIMIZATION: Batch database operations
                let markedSeasons = 0;
                let markedEpisodes = 0;
                
                if (Object.keys(allSeasonsData).length > 0) {
                    // Collect all operations first
                    const seasonOperations = [];
                    const allEpisodeInserts = [];
                    const seasonIdsToDelete = [];
                    const seasonMap = {}; // Map season number to season record

                    // Process all seasons to get/create season records
                    for (const [seasonNumStr, seasonData] of Object.entries(allSeasonsData)) {
                        const seasonNumber = parseInt(seasonNumStr);
                        
                        // Get or create season
                        // Uses index: idx_series_seasons_progress_season (composite index)
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
                            // Queue season update
                            seasonOperations.push({
                                id: season.id,
                                update: { completed: true }
                            });
                        }

                        seasonMap[seasonNumber] = season;

                        // Collect episodes for batch insert (only released episodes)
                        if (seasonData.episodes && Array.isArray(seasonData.episodes) && seasonData.episodes.length > 0) {
                            seasonIdsToDelete.push(season.id);
                            markedSeasons++;
                            markedEpisodes += seasonData.episodes.length;
                            
                            const episodeInserts = seasonData.episodes.map(ep => ({
                                series_season_id: season.id,
                                episode_number: typeof ep === 'number' ? ep : ep.episode_number,
                                watched_at: new Date().toISOString(),
                            }));
                            
                            allEpisodeInserts.push(...episodeInserts);
                        }
                    }

                    // Batch delete all existing episodes for these seasons
                    if (seasonIdsToDelete.length > 0) {
                        await supabase
                            .from('series_episodes')
                            .delete()
                            .in('series_season_id', seasonIdsToDelete);
                    }

                    // Batch insert all released episodes at once
                    if (allEpisodeInserts.length > 0) {
                        const { error: episodesError } = await supabase
                            .from('series_episodes')
                            .insert(allEpisodeInserts);

                        if (episodesError) throw episodesError;
                    }

                    // Batch update all seasons
                    for (const operation of seasonOperations) {
                        await supabase
                            .from('series_seasons')
                            .update(operation.update)
                            .eq('id', operation.id);
                    }
                }

                // Return skipped content information for user feedback
                const seriesProgressInfo = {
                    skippedSeasons: skippedSeasons,
                    skippedEpisodes: skippedEpisodes,
                    markedSeasons: markedSeasons,
                    markedEpisodes: markedEpisodes
                };

                return new Response(JSON.stringify({ 
                    watched: result, 
                    success: true,
                    seriesProgress: seriesProgressInfo
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (error) {
                console.error('Error syncing series progress:', error);
                // Don't fail the watched operation if series progress sync fails
                // Return with error info
                return new Response(JSON.stringify({ 
                    watched: result, 
                    success: true,
                    seriesProgress: {
                        skippedSeasons: [],
                        skippedEpisodes: [],
                        markedSeasons: 0,
                        markedEpisodes: 0,
                        error: 'Failed to sync series progress'
                    }
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }
        
        // Fallback return (should not be reached in normal flow)
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
        // Uses index: idx_watched_content_user_content_media (composite index for fast deletion)
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
                // Get series progress (don't use .single() to avoid error if not found)
                // Uses index: idx_series_progress_user_series (composite index)
                const { data: seriesProgressData, error: progressError } = await supabase
                    .from('series_progress')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('series_id', parseInt(itemId))
                    .maybeSingle();

                // Handle case where progress might not exist
                if (progressError && progressError.code !== 'PGRST116') {
                    throw progressError;
                }

                const seriesProgress = seriesProgressData;

                if (seriesProgress) {
                    // Get all seasons for this series progress
                    const { data: seasons, error: seasonsError } = await supabase
                        .from('series_seasons')
                        .select('id')
                        .eq('series_progress_id', seriesProgress.id);

                    if (seasonsError) {
                        console.error('Error fetching seasons for deletion:', seasonsError);
                    }

                    if (seasons && seasons.length > 0) {
                        const seasonIds = seasons.map(s => s.id);
                        
                        // Delete ALL episodes for all seasons (regardless of airdate)
                        // This ensures episodes without airdate are also deleted
                        const { error: episodesError } = await supabase
                            .from('series_episodes')
                            .delete()
                            .in('series_season_id', seasonIds);

                        if (episodesError) {
                            console.error('Error deleting episodes:', episodesError);
                            // Continue with season deletion even if episode deletion fails
                        }

                        // Delete all seasons
                        const { error: seasonsDeleteError } = await supabase
                            .from('series_seasons')
                            .delete()
                            .eq('series_progress_id', seriesProgress.id);

                        if (seasonsDeleteError) {
                            console.error('Error deleting seasons:', seasonsDeleteError);
                        }
                    }

                    // Delete series progress
                    const { error: progressDeleteError } = await supabase
                        .from('series_progress')
                        .delete()
                        .eq('id', seriesProgress.id);

                    if (progressDeleteError) {
                        console.error('Error deleting series progress:', progressDeleteError);
                    }
                }
            } catch (error) {
                console.error('Error clearing series progress:', error);
                // Don't fail the watched deletion if series progress clear fails
                // The watched_content deletion already succeeded
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

