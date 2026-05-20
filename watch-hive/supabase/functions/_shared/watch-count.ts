import { createServiceClient } from "./supabase.ts";

/** Count watched episodes in regular seasons only (excludes TMDB specials, season_number 0). */
export async function countWatchedRegularEpisodes(
  supabase: ReturnType<typeof createServiceClient>,
  progressId: string,
): Promise<number> {
  const { data: seasons, error: se } = await supabase
    .from("series_seasons")
    .select("id")
    .eq("series_progress_id", progressId)
    .gt("season_number", 0);
  if (se) throw se;
  const seasonIds = (seasons || []).map((s: { id: string }) => s.id);
  if (seasonIds.length === 0) return 0;
  const { count, error: ce } = await supabase
    .from("series_episodes")
    .select("id", { count: "exact", head: true })
    .in("series_season_id", seasonIds);
  if (ce) throw ce;
  return count ?? 0;
}
