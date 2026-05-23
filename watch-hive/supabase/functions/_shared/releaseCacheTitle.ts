import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { tmdbMovieCa, tmdbTvNextAir } from "./tmdb.ts";

const REGION = "CA";

/** Load show/movie title from release_cache, fetching TMDB + upserting on miss. */
export async function resolveContentTitle(
  supabase: SupabaseClient,
  apiKey: string,
  contentId: number,
  mediaType: "movie" | "tv",
): Promise<string | null> {
  const { data: cached } = await supabase
    .from("release_cache")
    .select("title")
    .eq("content_id", contentId)
    .eq("media_type", mediaType)
    .maybeSingle();

  const cachedTitle = cached?.title?.trim();
  if (cachedTitle) return cachedTitle;

  try {
    const row =
      mediaType === "movie"
        ? await tmdbMovieCa(apiKey, contentId)
        : await tmdbTvNextAir(apiKey, contentId);

    const now = new Date().toISOString();
    await supabase.from("release_cache").upsert(
      {
        content_id: contentId,
        media_type: mediaType,
        title: row.title,
        release_date: row.release_date,
        poster_path: row.poster_path,
        refreshed_at: now,
        tmdb_region: REGION,
        updated_at: now,
      },
      { onConflict: "content_id,media_type" },
    );

    return row.title;
  } catch (e) {
    console.error("resolveContentTitle TMDB fetch failed:", contentId, mediaType, e);
    return null;
  }
}

/** Ensure release_cache has a title row when ingesting TV airings (no notification needed). */
export async function ensureReleaseCacheTitle(
  supabase: SupabaseClient,
  apiKey: string,
  showId: number,
): Promise<void> {
  await resolveContentTitle(supabase, apiKey, showId, "tv");
}
