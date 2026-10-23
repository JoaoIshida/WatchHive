import { getServerUser, createServerClient } from '../../../../lib/supabase-server';
import { fetchTMDB } from '../../../utils';
import { syncTvWatchedContentFromProgress } from '../../../../utils/syncTvWatchedContent';
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
} from '../../../../utils/seriesProgressDb';

/**
 * Fill season: insert only released episodes not already in DB. Update season.completed.
 * Returns { filled, skippedUnreleased, seasonCompleted }
 */
async function fillOneSeason(supabase, seriesIdStr, seriesProgressId, seasonNumber, seriesTvMeta) {
    const seasonData = await fetchTMDB(`/tv/${seriesIdStr}/season/${seasonNumber}`, {
        language: 'en-CA',
    });

    const mazeMap = await getTvmazeEpisodeScheduleMap(seriesIdStr, seasonNumber);

    const allEps = seasonData?.episodes || [];
    const releasedEpisodes = allEps.filter((ep) =>
        isEpisodeReleasedOrdered(ep, seasonData, mazeMap, seriesTvMeta),
    );
    const skippedUnreleased = allEps.length - releasedEpisodes.length;

    if (releasedEpisodes.length === 0) {
        return { filled: 0, skippedUnreleased, seasonCompleted: false };
    }

    const season = await ensureSeriesSeason(supabase, seriesProgressId, seasonNumber);

    const { data: existingRows, error: exErr } = await supabase
        .from('series_episodes')
        .select('episode_number')
        .eq('series_season_id', season.id);

    if (exErr) throw exErr;

    const have = new Set((existingRows || []).map((r) => r.episode_number));
    const toInsert = releasedEpisodes.filter((ep) => !have.has(ep.episode_number));

    await insertMissingEpisodes(
        supabase,
        season.id,
        toInsert.map((ep) => ep.episode_number),
    );

    for (const ep of releasedEpisodes) {
        have.add(ep.episode_number);
    }
    const seasonFullyWatched = releasedEpisodes.every((ep) => have.has(ep.episode_number));

    const { error: upErr } = await supabase
        .from('series_seasons')
        .update({ completed: seasonFullyWatched })
        .eq('id', season.id);
    if (upErr) throw upErr;

    return {
        filled: toInsert.length,
        skippedUnreleased,
        seasonCompleted: seasonFullyWatched,
    };
}

/**
 * True if every released episode (regular seasons only) is in DB.
 */
async function computeSeriesCaughtUp(supabase, seriesProgressId, seriesIdStr) {
    const seriesData = await fetchTMDB(`/tv/${seriesIdStr}`, { language: 'en-CA' });
    const seriesTvMeta = buildSeriesTvReleaseMeta(seriesData);
    const allSeasons = seriesData?.seasons || [];

    for (const seasonInfo of allSeasons) {
        const sn = seasonInfo.season_number;
        if (sn <= 0) continue;
        if (!isSeasonReleased(seasonInfo)) continue;

        const seasonData = await fetchTMDB(`/tv/${seriesIdStr}/season/${sn}`, {
            language: 'en-CA',
        });
        const mazeMap = await getTvmazeEpisodeScheduleMap(seriesIdStr, sn);
        const released = (seasonData?.episodes || []).filter((ep) =>
            isEpisodeReleasedOrdered(ep, seasonData, mazeMap, seriesTvMeta),
        );
        if (released.length === 0) continue;

        const { data: seasonRow } = await supabase
            .from('series_seasons')
            .select('id')
            .eq('series_progress_id', seriesProgressId)
            .eq('season_number', sn)
            .maybeSingle();

        if (!seasonRow) return false;

        const { data: eps } = await supabase
            .from('series_episodes')
            .select('episode_number')
            .eq('series_season_id', seasonRow.id);

        const watched = new Set((eps || []).map((e) => e.episode_number));
        for (const ep of released) {
            if (!watched.has(ep.episode_number)) return false;
        }
    }
    return true;
}

/**
 * POST /api/series-progress/[seriesId]/fill-missing
 * Insert only released episodes that are not yet recorded (no delete of existing rows).
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
        const seriesIdStr = String(seriesId);
        let body = {};
        try {
            body = await req.json();
        } catch {
            body = {};
        }
        const { seasonNumber } = body;

        const supabase = await createServerClient();

        const seriesProgress = await ensureSeriesProgress(supabase, user.id, seriesIdStr);

        let totalFilled = 0;
        let totalSkippedUnreleased = 0;

        if (seasonNumber !== undefined && seasonNumber !== null) {
            const sn = parseInt(String(seasonNumber), 10);
            if (Number.isNaN(sn) || sn <= 0) {
                return new Response(JSON.stringify({ error: 'Invalid seasonNumber (specials are not tracked)' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            const seriesPayload = await fetchTMDB(`/tv/${seriesIdStr}`, { language: 'en-CA' });
            const seriesTvMeta = buildSeriesTvReleaseMeta(seriesPayload);
            const r = await fillOneSeason(supabase, seriesIdStr, seriesProgress.id, sn, seriesTvMeta);
            totalFilled += r.filled;
            totalSkippedUnreleased += r.skippedUnreleased;
        } else {
            const seriesData = await fetchTMDB(`/tv/${seriesIdStr}`, { language: 'en-CA' });
            const seriesTvMeta = buildSeriesTvReleaseMeta(seriesData);
            const allSeasons = seriesData?.seasons || [];
            const sorted = [...allSeasons]
                .filter((s) => s.season_number > 0 && isSeasonReleased(s))
                .sort((a, b) => a.season_number - b.season_number);

            for (const seasonInfo of sorted) {
                const r = await fillOneSeason(
                    supabase,
                    seriesIdStr,
                    seriesProgress.id,
                    seasonInfo.season_number,
                    seriesTvMeta,
                );
                totalFilled += r.filled;
                totalSkippedUnreleased += r.skippedUnreleased;
            }
        }

        const caughtUp = await computeSeriesCaughtUp(supabase, seriesProgress.id, seriesIdStr);

        const { error: progUpErr } = await supabase
            .from('series_progress')
            .update({
                completed: caughtUp,
                last_watched: new Date().toISOString(),
            })
            .eq('id', seriesProgress.id);
        if (progUpErr) throw progUpErr;

        await syncTvWatchedContentFromProgress(
            supabase,
            user.id,
            parseInt(seriesIdStr, 10),
            seriesProgress.id,
        );

        return new Response(
            JSON.stringify({
                success: true,
                filled: totalFilled,
                skippedUnreleased: totalSkippedUnreleased,
                seriesCompleted: caughtUp,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    } catch (error) {
        console.error('Error filling missing episodes:', error);
        return new Response(JSON.stringify({ error: 'Failed to fill missing episodes' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
