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

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * POST /api/series-progress/[seriesId]/seasons
 * Mark season as completed or uncompleted
 */
export async function POST(req, { params }) {
    try {
        const user = await getServerUser();
        if (!user) return json({ error: 'Unauthorized' }, 401);

        const { seriesId } = await params;
        const body = await req.json();
        const { seasonNumber, completed, deleteEpisodes = true } = body;

        if (seasonNumber === undefined || completed === undefined) {
            return json({ error: 'seasonNumber and completed are required' }, 400);
        }
        if (Number(seasonNumber) <= 0) {
            return json({ error: 'Specials (season 0) are not tracked in series progress' }, 400);
        }

        const supabase = await createServerClient();
        let progressId;

        if (completed) {
            // Fetch before writing anything: a TMDB failure must not leave a "complete" season with 0 episodes.
            let releasedEpisodeNumbers;
            try {
                const [seasonData, tvDetails] = await Promise.all([
                    fetchTMDB(`/tv/${seriesId}/season/${seasonNumber}`, { language: 'en-CA' }),
                    fetchTMDB(`/tv/${seriesId}`, { language: 'en-CA' }),
                ]);
                const seriesTvMeta = buildSeriesTvReleaseMeta(tvDetails);
                const mazeMap = await getTvmazeEpisodeScheduleMap(seriesId, seasonNumber);
                releasedEpisodeNumbers = (seasonData?.episodes || [])
                    .filter((ep) => isEpisodeReleasedOrdered(ep, seasonData, mazeMap, seriesTvMeta))
                    .map((ep) => ep.episode_number);
            } catch (error) {
                console.error('Error fetching season episodes:', error);
                return json({ error: 'Could not load season episodes. Try again shortly.' }, 503);
            }

            if (releasedEpisodeNumbers.length === 0) {
                return json({ error: 'No episodes of this season have aired yet' }, 400);
            }

            const seriesProgress = await ensureSeriesProgress(supabase, user.id, seriesId);
            const season = await ensureSeriesSeason(supabase, seriesProgress.id, seasonNumber);
            await insertMissingEpisodes(supabase, season.id, releasedEpisodeNumbers);
            await setSeasonCompletedFromReleased(supabase, season.id, releasedEpisodeNumbers);
            progressId = seriesProgress.id;
        } else {
            const { data: seriesProgress, error: progressError } = await supabase
                .from('series_progress')
                .select('id')
                .eq('user_id', user.id)
                .eq('series_id', parseInt(seriesId, 10))
                .maybeSingle();
            if (progressError) throw progressError;
            if (!seriesProgress) return json({ success: true });
            progressId = seriesProgress.id;

            const { data: season, error: seasonError } = await supabase
                .from('series_seasons')
                .select('id')
                .eq('series_progress_id', progressId)
                .eq('season_number', Number(seasonNumber))
                .maybeSingle();
            if (seasonError) throw seasonError;

            if (season) {
                // deleteEpisodes=false is used when unmarking individual episodes (keeps other episodes)
                if (deleteEpisodes) {
                    const { error: deleteEpisodesError } = await supabase
                        .from('series_episodes')
                        .delete()
                        .eq('series_season_id', season.id);
                    if (deleteEpisodesError) throw deleteEpisodesError;
                }
                const { error: updateError } = await supabase
                    .from('series_seasons')
                    .update({ completed: false })
                    .eq('id', season.id);
                if (updateError) throw updateError;
            }
        }

        await syncTvWatchedContentFromProgress(supabase, user.id, parseInt(seriesId, 10), progressId);
        await syncSeriesCompletionFlag(supabase, progressId, seriesId);

        return json({ success: true });
    } catch (error) {
        console.error('Error updating season:', error);
        return json({ error: 'Failed to update season' }, 500);
    }
}
