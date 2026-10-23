import { getServerUser, createServerClient } from '../../lib/supabase-server';
import { fetchTMDB } from '../utils';
import { syncTvWatchedContentFromProgress } from '../../utils/syncTvWatchedContent';
import { buildSeriesTvReleaseMeta, isEpisodeReleasedOrdered, isUnreleased } from '../../utils/releaseDateValidator';
import { getTvmazeEpisodeScheduleMap } from '../../lib/tvmazeEpisodeSchedule';
import { syncSeriesCompletionFlag } from '../../utils/syncSeriesCompletionFlag';
import {
    ensureSeriesProgress,
    ensureSeriesSeason,
    insertMissingEpisodes,
    setSeasonCompletedFromReleased,
} from '../../utils/seriesProgressDb';

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
        const { data: existing, error: existingErr } = await supabase
            .from('watched_content')
            .select('*')
            .eq('user_id', user.id)
            .eq('content_id', itemId)
            .eq('media_type', mediaType)
            .maybeSingle();
        if (existingErr) throw existingErr;

        let result;
        if (existing) {
            // Rewatch: atomic increment (read-modify-write would lose concurrent clicks).
            const { data, error } = await supabase.rpc('bump_times_watched', {
                p_id: existing.id,
                p_delta: 1,
                p_date_watched: dateWatched || new Date().toISOString(),
            });
            if (error) throw error;
            result = Array.isArray(data) ? data[0] : data;

            // A rewatch only bumps the counter. Re-running "mark all" here used to delete and
            // re-insert every episode, re-marking ones the user had deliberately unmarked.
            return new Response(JSON.stringify({ watched: result, success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
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

        if (mediaType === 'tv' && result?.id) {
            const { error: wrErr } = await supabase.from('watching_reminders').insert({
                watched_content_id: result.id,
                use_global_default: true,
            });
            if (wrErr && wrErr.code !== '23505') {
                console.error('watching_reminders insert:', wrErr);
            }
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
                const seriesTvMeta = buildSeriesTvReleaseMeta(seriesData);
                const seasons = seriesData?.seasons || [];

                // OPTIMIZATION: Parallel fetch all seasons with date validation
                // Track skipped content for user feedback
                const skippedSeasons = [];
                const skippedEpisodes = [];

                // Filter unreleased seasons BEFORE fetching and fetch all released seasons in parallel
                const seasonPromises = seasons
                    .filter(season => {
                        // Specials (season 0) are not tracked in series progress.
                        if (!(season.season_number > 0)) return false;
                        // Pre-filter: Skip unreleased seasons before making API calls
                        if (season.air_date) {
                            if (isUnreleased(season.air_date)) {
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

                            const mazeMap = await getTvmazeEpisodeScheduleMap(itemId, season.season_number);

                            const allEpisodes = seasonData?.episodes || [];
                            const releasedEpisodes = allEpisodes.filter((ep) =>
                                isEpisodeReleasedOrdered(ep, seasonData, mazeMap, seriesTvMeta),
                            );
                            const unreleasedEpisodes = allEpisodes.filter(
                                (ep) => !isEpisodeReleasedOrdered(ep, seasonData, mazeMap, seriesTvMeta),
                            );

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
                            throw error;
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

                let markedSeasons = 0;
                let markedEpisodes = 0;

                const seriesProgress = await ensureSeriesProgress(supabase, user.id, itemId);
                for (const [seasonNumStr, seasonData] of Object.entries(allSeasonsData)) {
                    const released = seasonData.episodes.map((ep) => ep.episode_number);
                    const season = await ensureSeriesSeason(supabase, seriesProgress.id, parseInt(seasonNumStr, 10));
                    await insertMissingEpisodes(supabase, season.id, released);
                    await setSeasonCompletedFromReleased(supabase, season.id, released);
                    markedSeasons++;
                    markedEpisodes += released.length;
                }

                // Return skipped content information for user feedback
                const seriesProgressInfo = {
                    skippedSeasons: skippedSeasons,
                    skippedEpisodes: skippedEpisodes,
                    markedSeasons: markedSeasons,
                    markedEpisodes: markedEpisodes
                };

                await syncTvWatchedContentFromProgress(
                    supabase,
                    user.id,
                    parseInt(itemId, 10),
                    seriesProgress.id,
                    { forceWatched: true, removeIfNoEpisodes: false },
                );
                await syncSeriesCompletionFlag(supabase, seriesProgress.id, itemId);

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
                const { data: sp } = await supabase
                    .from('series_progress')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('series_id', parseInt(itemId, 10))
                    .maybeSingle();
                if (sp?.id) {
                    try {
                        await syncTvWatchedContentFromProgress(
                            supabase,
                            user.id,
                            parseInt(itemId, 10),
                            sp.id,
                            { forceWatched: true, removeIfNoEpisodes: false },
                        );
                    } catch (syncErr) {
                        console.error('syncTvWatchedContentFromProgress after partial tv watch:', syncErr);
                    }
                }
                // The watched row exists but episodes may be partial: say so instead of claiming success.
                return new Response(JSON.stringify({
                    watched: result,
                    success: false,
                    error: 'Marked as watched, but episodes could not be synced. Try again shortly.',
                    seriesProgress: {
                        skippedSeasons: [],
                        skippedEpisodes: [],
                        markedSeasons: 0,
                        markedEpisodes: 0,
                        error: 'Failed to sync series progress'
                    }
                }), {
                    status: 502,
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

        // "-" on the watched counter: drop one viewing, keep the item (and its episode progress).
        if (searchParams.get('decrement') === '1') {
            const { data: existing, error: exErr } = await supabase
                .from('watched_content')
                .select('id, times_watched')
                .eq('user_id', user.id)
                .eq('content_id', itemId)
                .eq('media_type', mediaType)
                .maybeSingle();
            if (exErr) throw exErr;
            if (existing && existing.times_watched > 1) {
                const { data, error } = await supabase.rpc('bump_times_watched', {
                    p_id: existing.id,
                    p_delta: -1,
                    p_date_watched: null,
                });
                if (error) throw error;
                return new Response(
                    JSON.stringify({ success: true, watched: Array.isArray(data) ? data[0] : data }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );
            }
            // Count of 1 (or missing): fall through to a full removal.
        }

        if (mediaType === 'tv') {
            const { data: seriesProgressData, error: progressError } = await supabase
                .from('series_progress')
                .select('id')
                .eq('user_id', user.id)
                .eq('series_id', parseInt(itemId, 10))
                .maybeSingle();

            if (progressError && progressError.code !== 'PGRST116') {
                throw progressError;
            }

            if (seriesProgressData) {
                const { data: seasons, error: seasonsError } = await supabase
                    .from('series_seasons')
                    .select('id')
                    .eq('series_progress_id', seriesProgressData.id);

                if (seasonsError) throw seasonsError;

                if (seasons && seasons.length > 0) {
                    const seasonIds = seasons.map((s) => s.id);
                    const { error: episodesError } = await supabase
                        .from('series_episodes')
                        .delete()
                        .in('series_season_id', seasonIds);
                    if (episodesError) throw episodesError;

                    const { error: seasonsDeleteError } = await supabase
                        .from('series_seasons')
                        .delete()
                        .eq('series_progress_id', seriesProgressData.id);
                    if (seasonsDeleteError) throw seasonsDeleteError;
                }

                const { error: progressDeleteError } = await supabase
                    .from('series_progress')
                    .delete()
                    .eq('id', seriesProgressData.id);
                if (progressDeleteError) throw progressDeleteError;
            }
        }

        const { error } = await supabase
            .from('watched_content')
            .delete()
            .eq('user_id', user.id)
            .eq('content_id', itemId)
            .eq('media_type', mediaType);

        if (error) throw error;

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

