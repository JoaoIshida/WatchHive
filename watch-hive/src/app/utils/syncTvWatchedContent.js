/**
 * Keeps watched_content (media_type tv) in sync with episode-level progress:
 * - ≥1 episode watched → ensure a watched row exists (for catalog cron, reminders, list).
 * - 0 episodes → remove watched row (unless forceWatched).
 * POST /api/watched (tv) uses forceWatched so "mark watched" sticks even when no episodes were synced yet.
 */

export async function countWatchedEpisodesForProgress(supabase, progressId) {
    const { data: seasons, error: se } = await supabase
        .from('series_seasons')
        .select('id')
        .eq('series_progress_id', progressId);
    if (se) throw se;
    const seasonIds = (seasons || []).map((s) => s.id);
    if (seasonIds.length === 0) return 0;
    const { count, error: ce } = await supabase
        .from('series_episodes')
        .select('id', { count: 'exact', head: true })
        .in('series_season_id', seasonIds);
    if (ce) throw ce;
    return count ?? 0;
}

/**
 * @param {*} supabase - Supabase client (server)
 * @param {string} userId
 * @param {number} seriesId
 * @param {string} progressId
 * @param {{ forceWatched?: boolean, removeIfNoEpisodes?: boolean }} [options]
 */
export async function syncTvWatchedContentFromProgress(
    supabase,
    userId,
    seriesId,
    progressId,
    options = {},
) {
    const { forceWatched = false, removeIfNoEpisodes = true } = options;
    const sid = typeof seriesId === 'number' ? seriesId : parseInt(String(seriesId), 10);
    const n = await countWatchedEpisodesForProgress(supabase, progressId);
    const shouldHaveWatched = n > 0 || forceWatched;

    if (shouldHaveWatched) {
        const { data: existing, error: selErr } = await supabase
            .from('watched_content')
            .select('id')
            .eq('user_id', userId)
            .eq('content_id', sid)
            .eq('media_type', 'tv')
            .maybeSingle();
        if (selErr) throw selErr;

        const now = new Date().toISOString();
        if (!existing) {
            const { data: inserted, error: insErr } = await supabase
                .from('watched_content')
                .insert({
                    user_id: userId,
                    content_id: sid,
                    media_type: 'tv',
                    date_watched: now,
                    times_watched: 1,
                })
                .select('id')
                .single();
            if (insErr) throw insErr;
            const { error: wrErr } = await supabase.from('watching_reminders').insert({
                watched_content_id: inserted.id,
                use_global_default: true,
            });
            if (wrErr && wrErr.code !== '23505') throw wrErr;
        } else {
            const { error: upErr } = await supabase
                .from('watched_content')
                .update({ date_watched: now })
                .eq('id', existing.id);
            if (upErr) throw upErr;
        }
    } else if (removeIfNoEpisodes) {
        const { error: delErr } = await supabase
            .from('watched_content')
            .delete()
            .eq('user_id', userId)
            .eq('content_id', sid)
            .eq('media_type', 'tv');
        if (delErr) throw delErr;
    }
}
