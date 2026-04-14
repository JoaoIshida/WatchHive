import { getServerUser, createServerClient } from '../../../../lib/supabase-server';
import { fetchTMDB } from '../../../utils';

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

/**
 * GET /api/series-progress/[seriesId]/first-unwatched
 * First released episode (by season asc, episode asc) not in user's progress.
 */
export async function GET(req, { params }) {
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
        const supabase = await createServerClient();

        const { data: seriesProgress } = await supabase
            .from('series_progress')
            .select('id')
            .eq('user_id', user.id)
            .eq('series_id', seriesId)
            .maybeSingle();

        const { data: seasonRows } = seriesProgress
            ? await supabase
                  .from('series_seasons')
                  .select('id, season_number')
                  .eq('series_progress_id', seriesProgress.id)
            : { data: [] };

        const seasonNumberById = new Map();
        for (const s of seasonRows || []) {
            seasonNumberById.set(s.id, s.season_number);
        }

        const { data: episodeRows } =
            seasonRows && seasonRows.length > 0
                ? await supabase
                      .from('series_episodes')
                      .select('episode_number, series_season_id')
                      .in(
                          'series_season_id',
                          seasonRows.map((s) => s.id),
                      )
                : { data: [] };

        const watchedBySeason = new Map();
        for (const ep of episodeRows || []) {
            const sn = seasonNumberById.get(ep.series_season_id);
            if (sn === undefined) continue;
            if (!watchedBySeason.has(sn)) watchedBySeason.set(sn, new Set());
            watchedBySeason.get(sn).add(ep.episode_number);
        }

        const seriesData = await fetchTMDB(`/tv/${seriesIdStr}`, { language: 'en-CA' });
        const allSeasons = seriesData?.seasons || [];
        const sorted = [...allSeasons]
            .filter((s) => s.season_number > 0 && isSeasonReleased(s))
            .sort((a, b) => a.season_number - b.season_number);

        for (const seasonInfo of sorted) {
            const sn = seasonInfo.season_number;
            const seasonData = await fetchTMDB(`/tv/${seriesIdStr}/season/${sn}`, {
                language: 'en-CA',
            });
            const released = (seasonData?.episodes || [])
                .filter((ep) => isEpisodeReleased(ep, seasonData))
                .sort((a, b) => a.episode_number - b.episode_number);

            const watched = watchedBySeason.get(sn) || new Set();

            for (const ep of released) {
                if (!watched.has(ep.episode_number)) {
                    return new Response(
                        JSON.stringify({
                            seasonNumber: sn,
                            episodeNumber: ep.episode_number,
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
            }
        }

        return new Response(JSON.stringify({ error: 'No unwatched released episode' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error resolving first unwatched:', error);
        return new Response(JSON.stringify({ error: 'Failed to resolve first unwatched episode' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
