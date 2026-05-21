import { DateTime } from "https://esm.sh/luxon@3.5.0";
import { assertCronAuthorized } from "../_shared/cron-auth.ts";
import { releaseAtUtc } from "../_shared/airingTime.ts";
import { edgeLog } from "../_shared/edgeLog.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { tmdbMovieCa, tmdbTvNextAir } from "../_shared/tmdb.ts";
import { fetchUpcomingTvmazeEpisodes } from "../_shared/tvmaze.ts";

const FN = "ingest_regional_airings";
const BATCH_SHOWS = 20;
const REGION = "CA";

type MediaRow = { content_id: number; media_type: "movie" | "tv" };

Deno.serve(async (req) => {
  edgeLog(FN, "request", { method: req.method });
  const authErr = assertCronAuthorized(req);
  if (authErr) return authErr;

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing TMDB_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = serviceClient();
    const { data: wishlistRows, error: wErr } = await supabase
      .from("wishlist")
      .select("content_id, media_type");
    if (wErr) throw wErr;

    const { data: watchedTv, error: tvErr } = await supabase
      .from("watched_content")
      .select("content_id")
      .eq("media_type", "tv");
    if (tvErr) throw tvErr;

    const tvShows = new Set<number>();
    const movies: MediaRow[] = [];

    for (const w of wishlistRows ?? []) {
      if (w.media_type === "tv") tvShows.add(w.content_id);
      else if (w.media_type === "movie") {
        movies.push({ content_id: w.content_id, media_type: "movie" });
      }
    }
    for (const row of watchedTv ?? []) tvShows.add(row.content_id);

    const allShows = [...tvShows].sort((a, b) => a - b);
    const slots = Math.max(1, Math.ceil(allShows.length / BATCH_SHOWS));
    const slot =
      Math.floor(Date.now() / (3 * 3600 * 1000)) % slots;
    const showIds = allShows.slice(
      slot * BATCH_SHOWS,
      (slot + 1) * BATCH_SHOWS,
    );
    let episodesUpserted = 0;
    let airingsUpserted = 0;
    let moviesUpserted = 0;
    let tvmazeMiss = 0;

    for (const showId of showIds) {
      const eps = await fetchUpcomingTvmazeEpisodes(showId, apiKey, 4);
      if (eps.length === 0) {
        tvmazeMiss++;
        const t = await tmdbTvNextAir(apiKey, showId);
        if (!t.release_date || !t.next?.season_number || !t.next?.episode_number) {
          continue;
        }
        const at = releaseAtUtc({ tmdbDate: t.release_date, regionCode: REGION });
        if (!at) continue;
        await upsertTmdbEpisodeAiring(
          supabase,
          showId,
          t.next.season_number,
          t.next.episode_number,
          null,
          at,
        );
        airingsUpserted++;
        continue;
      }

      for (const ep of eps) {
        const season = ep.season ?? 1;
        const at = releaseAtUtc({
          airstamp: ep.airstamp,
          airdate: ep.airdate,
          regionCode: REGION,
        });
        if (!at) continue;
        await upsertTvmazeEpisodeAiring(
          supabase,
          showId,
          season,
          ep.number,
          ep.name ?? null,
          at,
          "tvmaze",
        );
        episodesUpserted++;
        airingsUpserted++;
      }
    }

    const movieCandidates = new Map<string, MediaRow>();
    for (const m of movies) movieCandidates.set(`${m.media_type}:${m.content_id}`, m);

    for (const { content_id } of movieCandidates.values()) {
      const { data: cached } = await supabase
        .from("release_cache")
        .select("release_date, title")
        .eq("content_id", content_id)
        .eq("media_type", "movie")
        .maybeSingle();

      let releaseDate = cached?.release_date as string | null;
      if (!releaseDate) {
        const m = await tmdbMovieCa(apiKey, content_id);
        releaseDate = m.release_date;
        if (releaseDate) {
          await supabase.from("release_cache").upsert(
            {
              content_id,
              media_type: "movie",
              title: m.title,
              release_date: releaseDate,
              poster_path: m.poster_path,
              refreshed_at: new Date().toISOString(),
              tmdb_region: REGION,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "content_id,media_type" },
          );
        }
      }
      if (!releaseDate) continue;
      const at = releaseAtUtc({ tmdbDate: releaseDate, regionCode: REGION });
      if (!at) continue;

      await upsertMovieAiring(supabase, content_id, at);
      moviesUpserted++;
    }

    const windowEnd = DateTime.utc().plus({ days: 35 }).toISO()!;
    const { data: staleMovieCaches } = await supabase
      .from("release_cache")
      .select("content_id, release_date, title")
      .eq("media_type", "movie")
      .not("release_date", "is", null)
      .gte("release_date", DateTime.utc().minus({ days: 1 }).toISODate()!)
      .lte("release_date", DateTime.utc().plus({ days: 35 }).toISODate()!);

    for (const c of staleMovieCaches ?? []) {
      if (movieCandidates.has(`movie:${c.content_id}`)) continue;
      const at = releaseAtUtc({
        tmdbDate: c.release_date as string,
        regionCode: REGION,
      });
      if (!at || at > windowEnd) continue;
      await upsertMovieAiring(supabase, c.content_id as number, at);
    }

    const cacheSynced = await syncAiringsFromReleaseCache(
      supabase,
      apiKey,
      [...tvShows],
      movieCandidates,
    );

    const body = {
      ok: true,
      tvShowsConsidered: showIds.length,
      episodesUpserted,
      airingsUpserted,
      moviesUpserted,
      tvmazeMiss,
      cacheSynced,
    };
    edgeLog(FN, "done", body);
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    edgeLog(FN, "fatal", { err: String(e) });
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/** Backfill regional_airings from release_cache for titles not updated this run. */
async function syncAiringsFromReleaseCache(
  supabase: ReturnType<typeof serviceClient>,
  apiKey: string,
  tvShowIds: number[],
  movieCandidates: Map<string, MediaRow>,
): Promise<number> {
  const windowStart = DateTime.utc().minus({ days: 1 }).toISODate()!;
  const windowEnd = DateTime.utc().plus({ days: 35 }).toISODate()!;
  const { data: caches } = await supabase
    .from("release_cache")
    .select("content_id, media_type, release_date, title")
    .not("release_date", "is", null)
    .gte("release_date", windowStart)
    .lte("release_date", windowEnd);
  let n = 0;
  for (const c of caches ?? []) {
    const at = releaseAtUtc({
      tmdbDate: c.release_date as string,
      regionCode: REGION,
    });
    if (!at) continue;
    if (c.media_type === "movie") {
      if (!movieCandidates.has(`movie:${c.content_id}`)) continue;
      await upsertMovieAiring(supabase, c.content_id, at);
      n++;
      continue;
    }
    if (c.media_type === "tv" && tvShowIds.includes(c.content_id)) {
      const { data: existing } = await supabase
        .from("regional_airings")
        .select("id")
        .eq("show_id", c.content_id)
        .eq("region_code", REGION)
        .gte("release_at_utc", DateTime.utc().minus({ days: 1 }).toISO()!)
        .limit(1);
      if ((existing ?? []).length > 0) continue;
      const t = await tmdbTvNextAir(apiKey, c.content_id);
      if (t.next?.season_number && t.next?.episode_number) {
        await upsertTmdbEpisodeAiring(
          supabase,
          c.content_id,
          t.next.season_number,
          t.next.episode_number,
          null,
          at,
        );
      }
      n++;
    }
  }
  return n;
}

async function upsertMovieAiring(
  supabase: ReturnType<typeof serviceClient>,
  contentId: number,
  releaseAtUtcIso: string,
) {
  const { data: existing } = await supabase
    .from("regional_airings")
    .select("id")
    .eq("content_id", contentId)
    .eq("media_type", "movie")
    .eq("region_code", REGION)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("regional_airings")
      .update({
        release_at_utc: releaseAtUtcIso,
        source: "tmdb",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("regional_airings").insert({
      content_id: contentId,
      media_type: "movie",
      region_code: REGION,
      release_at_utc: releaseAtUtcIso,
      source: "tmdb",
    });
  }
}

async function upsertTvmazeEpisodeAiring(
  supabase: ReturnType<typeof serviceClient>,
  showId: number,
  season: number,
  episode: number,
  title: string | null,
  releaseAtUtcIso: string,
  source: "tvmaze" | "tmdb" = "tvmaze",
) {
  await upsertTmdbEpisodeAiring(
    supabase,
    showId,
    season,
    episode,
    title,
    releaseAtUtcIso,
    source,
  );
}

async function upsertTmdbEpisodeAiring(
  supabase: ReturnType<typeof serviceClient>,
  showId: number,
  season: number,
  episode: number,
  title: string | null,
  releaseAtUtcIso: string,
  source: "tvmaze" | "tmdb" = "tmdb",
) {
  const { data: epRow, error: epErr } = await supabase
    .from("catalog_episodes")
    .upsert(
      {
        show_id: showId,
        season_number: season,
        episode_number: episode,
        title,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "show_id,season_number,episode_number" },
    )
    .select("id")
    .single();
  if (epErr) throw epErr;

  const { data: existing } = await supabase
    .from("regional_airings")
    .select("id")
    .eq("episode_id", epRow.id)
    .eq("region_code", REGION)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("regional_airings")
      .update({
        release_at_utc: releaseAtUtcIso,
        source,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("regional_airings").insert({
      show_id: showId,
      episode_id: epRow.id,
      region_code: REGION,
      release_at_utc: releaseAtUtcIso,
      source,
    });
  }
}
