/**
 * Race-safe get-or-create for series progress rows. Upsert on the table's UNIQUE key so two
 * concurrent first clicks on a new series/season both get the same row instead of a 23505.
 * Only the columns passed are written on conflict (merge-duplicates), so existing flags survive.
 */

export async function ensureSeriesProgress(supabase, userId, seriesId) {
    const { data, error } = await supabase
        .from('series_progress')
        .upsert(
            {
                user_id: userId,
                series_id: parseInt(String(seriesId), 10),
                last_watched: new Date().toISOString(),
            },
            { onConflict: 'user_id,series_id' },
        )
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function ensureSeriesSeason(supabase, seriesProgressId, seasonNumber) {
    const { data, error } = await supabase
        .from('series_seasons')
        .upsert(
            { series_progress_id: seriesProgressId, season_number: Number(seasonNumber) },
            { onConflict: 'series_progress_id,season_number' },
        )
        .select()
        .single();
    if (error) throw error;
    return data;
}

/** Add episodes without touching ones already marked (keeps their original watched_at). */
export async function insertMissingEpisodes(supabase, seasonId, episodeNumbers) {
    if (!episodeNumbers.length) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('series_episodes').upsert(
        episodeNumbers.map((n) => ({ series_season_id: seasonId, episode_number: n, watched_at: now })),
        { onConflict: 'series_season_id,episode_number', ignoreDuplicates: true },
    );
    if (error) throw error;
}

/** Season is complete when every released episode number is marked. */
export async function setSeasonCompletedFromReleased(supabase, seasonId, releasedEpisodeNumbers) {
    const { data, error } = await supabase
        .from('series_episodes')
        .select('episode_number')
        .eq('series_season_id', seasonId);
    if (error) throw error;
    const watched = new Set((data || []).map((r) => r.episode_number));
    const completed =
        releasedEpisodeNumbers.length > 0 && releasedEpisodeNumbers.every((n) => watched.has(n));
    const { error: upErr } = await supabase
        .from('series_seasons')
        .update({ completed })
        .eq('id', seasonId);
    if (upErr) throw upErr;
    return completed;
}
