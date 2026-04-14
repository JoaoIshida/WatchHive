import { getServerUser, createServerClient } from '../../../../lib/supabase-server';
import { fetchTMDB } from '../../../utils';
import { syncTvWatchedContentFromProgress } from '../../../../utils/syncTvWatchedContent';

function isEpisodeReleased(episode, seasonData = null) {
    if (!episode) return false;
    let airDate = episode.air_date;
    if (!airDate && seasonData && seasonData.air_date) {
        airDate = seasonData.air_date;
    }
    if (!airDate) {
        return true;
    }
    try {
        const releaseDate = new Date(airDate);
        releaseDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return releaseDate <= today;
    } catch {
        return true;
    }
}

function isSeasonReleased(season) {
    if (!season || !season.air_date) return false;
    try {
        const releaseDate = new Date(season.air_date);
        releaseDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return releaseDate <= today;
    } catch {
        return false;
    }
}

async function getOrCreateSeason(supabase, seriesProgressId, seasonNumber) {
    let { data: season, error: seasonError } = await supabase
        .from('series_seasons')
        .select('*')
        .eq('series_progress_id', seriesProgressId)
        .eq('season_number', seasonNumber)
        .single();

    if (seasonError && seasonError.code === 'PGRST116') {
        const { data: newSeason, error: createSeasonError } = await supabase
            .from('series_seasons')
            .insert({
                series_progress_id: seriesProgressId,
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
    return season;
}

/**
 * Fill season: insert only released episodes not already in DB. Update season.completed.
 * Returns { filled, skippedUnreleased, seasonCompleted }
 */
async function fillOneSeason(supabase, seriesIdStr, seriesProgressId, seasonNumber) {
    const seasonData = await fetchTMDB(`/tv/${seriesIdStr}/season/${seasonNumber}`, {
        language: 'en-CA',
    });

    const allEps = seasonData?.episodes || [];
    const releasedEpisodes = allEps.filter((ep) => isEpisodeReleased(ep, seasonData));
    const skippedUnreleased = allEps.length - releasedEpisodes.length;

    if (releasedEpisodes.length === 0) {
        return { filled: 0, skippedUnreleased, seasonCompleted: false };
    }

    const season = await getOrCreateSeason(supabase, seriesProgressId, seasonNumber);

    const { data: existingRows, error: exErr } = await supabase
        .from('series_episodes')
        .select('episode_number')
        .eq('series_season_id', season.id);

    if (exErr) throw exErr;

    const have = new Set((existingRows || []).map((r) => r.episode_number));
    const toInsert = releasedEpisodes.filter((ep) => !have.has(ep.episode_number));

    if (toInsert.length > 0) {
        const now = new Date().toISOString();
        const rows = toInsert.map((ep) => ({
            series_season_id: season.id,
            episode_number: ep.episode_number,
            watched_at: now,
        }));

        const { error: insErr } = await supabase.from('series_episodes').insert(rows);
        if (insErr) throw insErr;
    }

    for (const ep of releasedEpisodes) {
        have.add(ep.episode_number);
    }
    const seasonFullyWatched = releasedEpisodes.every((ep) => have.has(ep.episode_number));

    await supabase
        .from('series_seasons')
        .update({ completed: seasonFullyWatched })
        .eq('id', season.id);

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
    const allSeasons = seriesData?.seasons || [];

    for (const seasonInfo of allSeasons) {
        const sn = seasonInfo.season_number;
        if (sn <= 0) continue;
        if (!isSeasonReleased(seasonInfo)) continue;

        const seasonData = await fetchTMDB(`/tv/${seriesIdStr}/season/${sn}`, {
            language: 'en-CA',
        });
        const released = (seasonData?.episodes || []).filter((ep) =>
            isEpisodeReleased(ep, seasonData),
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
                    series_id: parseInt(seriesIdStr, 10),
                    last_watched: new Date().toISOString(),
                })
                .select()
                .single();

            if (createError) throw createError;
            seriesProgress = newProgress;
        } else if (progressError) {
            throw progressError;
        }

        let totalFilled = 0;
        let totalSkippedUnreleased = 0;

        if (seasonNumber !== undefined && seasonNumber !== null) {
            const sn = parseInt(String(seasonNumber), 10);
            if (Number.isNaN(sn)) {
                return new Response(JSON.stringify({ error: 'Invalid seasonNumber' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            const r = await fillOneSeason(supabase, seriesIdStr, seriesProgress.id, sn);
            totalFilled += r.filled;
            totalSkippedUnreleased += r.skippedUnreleased;
        } else {
            const seriesData = await fetchTMDB(`/tv/${seriesIdStr}`, { language: 'en-CA' });
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
                );
                totalFilled += r.filled;
                totalSkippedUnreleased += r.skippedUnreleased;
            }
        }

        const caughtUp = await computeSeriesCaughtUp(supabase, seriesProgress.id, seriesIdStr);

        await supabase
            .from('series_progress')
            .update({
                completed: caughtUp,
                last_watched: new Date().toISOString(),
            })
            .eq('id', seriesProgress.id);

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
