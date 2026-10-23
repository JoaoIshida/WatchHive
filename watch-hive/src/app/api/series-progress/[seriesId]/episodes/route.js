import { getServerUser, createServerClient } from '../../../../lib/supabase-server';
import { fetchTMDB } from '../../../utils';
import { syncTvWatchedContentFromProgress } from '../../../../utils/syncTvWatchedContent';
import { syncSeriesCompletionFlag } from '../../../../utils/syncSeriesCompletionFlag';
import { buildSeriesTvReleaseMeta, isEpisodeReleasedOrdered } from '../../../../utils/releaseDateValidator';
import { getTvmazeEpisodeScheduleMap } from '../../../../lib/tvmazeEpisodeSchedule';
import {
    ensureSeriesProgress,
    ensureSeriesSeason,
    insertMissingEpisodes,
    setSeasonCompletedFromReleased,
} from '../../../../utils/seriesProgressDb';

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

        if (Number(seasonNumber) <= 0) {
            return new Response(
                JSON.stringify({ error: 'Specials (season 0) are not tracked in series progress' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        /** Released episode numbers in this season; used to recompute season completion after a mark. */
        let releasedEpisodeNumbers = [];

        // If marking as watched, verify the episode exists and has aired (TMDB + TV Maze when mapped)
        if (watched) {
            try {
                const [seasonData, tvDetails] = await Promise.all([
                    fetchTMDB(`/tv/${seriesId}/season/${seasonNumber}`, {
                        language: 'en-CA',
                    }),
                    fetchTMDB(`/tv/${seriesId}`, { language: 'en-CA' }),
                ]);
                const seriesTvMeta = buildSeriesTvReleaseMeta(tvDetails);

                const episode = seasonData?.episodes?.find((ep) => ep.episode_number === episodeNumber);

                if (!episode) {
                    return new Response(
                        JSON.stringify({
                            error: 'Episode not found in database',
                            message: `Episode ${episodeNumber} of Season ${seasonNumber} is not available in TMDB yet.`,
                            episode: { seasonNumber, episodeNumber },
                        }),
                        { status: 404, headers: { 'Content-Type': 'application/json' } },
                    );
                }

                let mazeMap = null;
                try {
                    mazeMap = await getTvmazeEpisodeScheduleMap(seriesId, seasonNumber);
                } catch (e) {
                    console.warn('TVMaze schedule unavailable for episodes route:', e?.message ?? e);
                }

                const scheduleEp = mazeMap?.get(Number(episodeNumber)) ?? null;

                if (!isEpisodeReleasedOrdered(episode, seasonData, mazeMap, seriesTvMeta)) {
                    return new Response(
                        JSON.stringify({
                            error: 'Cannot mark unreleased episode as watched',
                            episode: {
                                name: episode.name || `Episode ${episodeNumber}`,
                                air_date:
                                    scheduleEp?.airdate ??
                                    episode.air_date ??
                                    (seasonData ? seasonData.air_date : null),
                            },
                        }),
                        { status: 400, headers: { 'Content-Type': 'application/json' } },
                    );
                }

                releasedEpisodeNumbers = (seasonData?.episodes || [])
                    .filter((ep) => isEpisodeReleasedOrdered(ep, seasonData, mazeMap, seriesTvMeta))
                    .map((ep) => ep.episode_number);
            } catch (error) {
                console.error('Error validating episode release date:', error);
                if (error.message && error.message.includes('404')) {
                    return new Response(
                        JSON.stringify({
                            error: 'Episode not found',
                            message: `Season ${seasonNumber} or episode ${episodeNumber} is not available in TMDB.`,
                            details: error.message,
                        }),
                        { status: 404, headers: { 'Content-Type': 'application/json' } },
                    );
                }
                return new Response(JSON.stringify({ error: 'Episode validation failed' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        const supabase = await createServerClient();

        const seriesProgress = await ensureSeriesProgress(supabase, user.id, seriesId);
        const season = await ensureSeriesSeason(supabase, seriesProgress.id, seasonNumber);

        if (watched) {
            await insertMissingEpisodes(supabase, season.id, [Number(episodeNumber)]);
            await setSeasonCompletedFromReleased(supabase, season.id, releasedEpisodeNumbers);
        } else {
            const { error: deleteError } = await supabase
                .from('series_episodes')
                .delete()
                .eq('series_season_id', season.id)
                .eq('episode_number', episodeNumber);
            if (deleteError) throw deleteError;

            const { error: unmarkErr } = await supabase
                .from('series_seasons')
                .update({ completed: false })
                .eq('id', season.id);
            if (unmarkErr) throw unmarkErr;
        }

        await syncTvWatchedContentFromProgress(
            supabase,
            user.id,
            parseInt(seriesId, 10),
            seriesProgress.id,
        );

        await syncSeriesCompletionFlag(supabase, seriesProgress.id, seriesId);

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

