import { fetchTMDB } from '../api/utils';
import { isSeasonReleased } from './releaseDateValidator';

/**
 * Set series_progress.completed when every premiered regular season is marked complete in DB.
 */
export async function syncSeriesCompletionFlag(supabase, seriesProgressId, seriesId) {
    const seriesIdNum = parseInt(String(seriesId), 10);
    if (!seriesProgressId || !Number.isFinite(seriesIdNum)) return;

    const { data: seasonRows, error: seasonsError } = await supabase
        .from('series_seasons')
        .select('season_number, completed')
        .eq('series_progress_id', seriesProgressId)
        .gt('season_number', 0);

    if (seasonsError) throw seasonsError;

    const completedBySeason = new Map(
        (seasonRows || []).map((row) => [row.season_number, row.completed === true]),
    );

    let regularSeasons = [];
    try {
        const tv = await fetchTMDB(`/tv/${seriesIdNum}`, { language: 'en-CA' });
        regularSeasons = (tv?.seasons || []).filter(
            (s) =>
                typeof s.season_number === 'number' &&
                s.season_number > 0 &&
                isSeasonReleased(s),
        );
    } catch (e) {
        console.error('syncSeriesCompletionFlag: TMDB seasons unavailable', e);
        regularSeasons = (seasonRows || []).map((row) => ({
            season_number: row.season_number,
        }));
    }

    if (regularSeasons.length === 0) {
        await supabase
            .from('series_progress')
            .update({ completed: false, updated_at: new Date().toISOString() })
            .eq('id', seriesProgressId);
        return;
    }

    const allComplete = regularSeasons.every((s) => completedBySeason.get(s.season_number) === true);

    await supabase
        .from('series_progress')
        .update({
            completed: allComplete,
            updated_at: new Date().toISOString(),
        })
        .eq('id', seriesProgressId);
}
