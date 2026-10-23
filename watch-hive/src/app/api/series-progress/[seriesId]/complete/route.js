import { getServerUser, createServerClient } from '../../../../lib/supabase-server';
import { fetchTMDB } from '../../../utils';
import { syncTvWatchedContentFromProgress } from '../../../../utils/syncTvWatchedContent';
import { syncSeriesCompletionFlag } from '../../../../utils/syncSeriesCompletionFlag';
import {
    buildSeriesTvReleaseMeta,
    isEpisodeReleasedOrdered,
    isSeasonReleased,
} from '../../../../utils/releaseDateValidator';
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

/** Released episode numbers per regular season (specials excluded). Throws on TMDB failure. */
async function fetchReleasedEpisodesBySeason(seriesId) {
    const seriesData = await fetchTMDB(`/tv/${seriesId}`, { language: 'en-CA' });
    const seriesTvMeta = buildSeriesTvReleaseMeta(seriesData);
    const seasons = (seriesData?.seasons || []).filter(
        (s) => s.season_number > 0 && isSeasonReleased(s),
    );

    const results = await Promise.all(
        seasons.map(async ({ season_number: seasonNumber }) => {
            const seasonData = await fetchTMDB(`/tv/${seriesId}/season/${seasonNumber}`, {
                language: 'en-CA',
            });
            const mazeMap = await getTvmazeEpisodeScheduleMap(seriesId, seasonNumber);
            const released = (seasonData?.episodes || [])
                .filter((ep) => isEpisodeReleasedOrdered(ep, seasonData, mazeMap, seriesTvMeta))
                .map((ep) => ep.episode_number);
            return [seasonNumber, released];
        }),
    );
    return results.filter(([, released]) => released.length > 0);
}

/**
 * POST /api/series-progress/[seriesId]/complete
 * Mark entire series as completed or uncompleted
 */
export async function POST(req, { params }) {
    try {
        const user = await getServerUser();
        if (!user) return json({ error: 'Unauthorized' }, 401);

        const { seriesId } = await params;
        const { completed } = await req.json();

        if (completed === undefined) {
            return json({ error: 'completed is required' }, 400);
        }

        const supabase = await createServerClient();
        let progressId;

        if (completed) {
            // Fetch everything before writing, so a TMDB failure can't leave a half-marked series.
            let releasedBySeason;
            try {
                releasedBySeason = await fetchReleasedEpisodesBySeason(seriesId);
            } catch (error) {
                console.error('Error fetching seasons/episodes:', error);
                return json({ error: 'Could not load series episodes. Try again shortly.' }, 503);
            }

            const seriesProgress = await ensureSeriesProgress(supabase, user.id, seriesId);
            progressId = seriesProgress.id;
            for (const [seasonNumber, released] of releasedBySeason) {
                const season = await ensureSeriesSeason(supabase, progressId, seasonNumber);
                await insertMissingEpisodes(supabase, season.id, released);
                await setSeasonCompletedFromReleased(supabase, season.id, released);
            }
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

            const { data: seasons, error: seasonsError } = await supabase
                .from('series_seasons')
                .select('id')
                .eq('series_progress_id', progressId);
            if (seasonsError) throw seasonsError;

            if (seasons?.length) {
                const { error: delErr } = await supabase
                    .from('series_episodes')
                    .delete()
                    .in('series_season_id', seasons.map((s) => s.id));
                if (delErr) throw delErr;
            }
            const { error: upErr } = await supabase
                .from('series_seasons')
                .update({ completed: false })
                .eq('series_progress_id', progressId);
            if (upErr) throw upErr;
        }

        await syncTvWatchedContentFromProgress(
            supabase,
            user.id,
            parseInt(seriesId, 10),
            progressId,
            { forceWatched: completed, removeIfNoEpisodes: true },
        );

        await syncSeriesCompletionFlag(supabase, progressId, seriesId);

        return json({ success: true });
    } catch (error) {
        console.error('Error updating series completion:', error);
        return json({ error: 'Failed to update series completion' }, 500);
    }
}
