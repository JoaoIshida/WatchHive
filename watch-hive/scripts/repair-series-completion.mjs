/**
 * One-off repair for rows corrupted by the old `on_episode_watched` trigger, which marked a season
 * (and then the series) complete as soon as one episode was inserted.
 *
 * Recomputes series_seasons.completed (every aired TMDB episode is marked) and
 * series_progress.completed (every aired regular season is complete) for every row.
 * Approximation: "aired" = TMDB air_date <= today (UTC); the app also consults TV Maze.
 *
 * Run AFTER applying migration 20261022120000_watched_marking_fixes.sql:
 *   node --env-file=.env scripts/repair-series-completion.mjs          # dry run
 *   node --env-file=.env scripts/repair-series-completion.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});
const today = new Date().toISOString().slice(0, 10);

async function tmdb(path) {
    const res = await fetch(`https://api.themoviedb.org/3${path}?api_key=${process.env.TMDB_API_KEY}`);
    if (!res.ok) throw new Error(`TMDB ${path} ${res.status}`);
    return res.json();
}

const aired = (d) => Boolean(d) && String(d).slice(0, 10) <= today;

let changed = 0;
let failed = 0;
for (let from = 0; ; from += 500) {
    const { data: progress, error } = await supabase
        .from('series_progress')
        .select('id, series_id, completed, series_seasons(id, season_number, completed, series_episodes(episode_number))')
        .order('id')
        .range(from, from + 499);
    if (error) throw error;
    if (!progress.length) break;

    for (const p of progress) {
        try {
            const tv = await tmdb(`/tv/${p.series_id}`);
            const airedSeasons = (tv.seasons || []).filter(
                (s) => s.season_number > 0 && s.episode_count !== 0 && aired(s.air_date),
            );
            const seasonComplete = new Map();
            for (const row of p.series_seasons.filter((s) => s.season_number > 0)) {
                const season = await tmdb(`/tv/${p.series_id}/season/${row.season_number}`);
                const airedEps = (season.episodes || []).filter((e) => aired(e.air_date)).map((e) => e.episode_number);
                const watched = new Set(row.series_episodes.map((e) => e.episode_number));
                const complete = airedEps.length > 0 && airedEps.every((n) => watched.has(n));
                seasonComplete.set(row.season_number, complete);
                if (complete !== row.completed) {
                    changed++;
                    console.log(`series ${p.series_id} S${row.season_number}: ${row.completed} -> ${complete}`);
                    if (apply) {
                        const { error: e } = await supabase.from('series_seasons').update({ completed: complete }).eq('id', row.id);
                        if (e) throw e;
                    }
                }
            }
            const seriesComplete =
                airedSeasons.length > 0 && airedSeasons.every((s) => seasonComplete.get(s.season_number) === true);
            if (seriesComplete !== p.completed) {
                changed++;
                console.log(`series ${p.series_id}: completed ${p.completed} -> ${seriesComplete}`);
                if (apply) {
                    const { error: e } = await supabase.from('series_progress').update({ completed: seriesComplete }).eq('id', p.id);
                    if (e) throw e;
                }
            }
        } catch (e) {
            failed++;
            console.error(`series ${p.series_id}: skipped (${e.message})`);
        }
    }
}
console.log(`${apply ? 'Applied' : 'Would change'} ${changed} flag(s); ${failed} series skipped.`);
