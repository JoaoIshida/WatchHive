const TVMAZE = "https://api.tvmaze.com";
const TMDB_BASE = "https://api.themoviedb.org/3";

export const TVMAZE_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent": "WatchHive/1.0 (https://themoviedb.org)",
};

export function tvmazeFetchUrl(path: string): string {
  const url = new URL(`${TVMAZE}${path}`);
  const key = Deno.env.get("TVMAZE_API_KEY");
  if (key) url.searchParams.set("api_key", key);
  return url.toString();
}

export type TvmazeEpisodeRow = {
  number: number;
  name?: string;
  airdate?: string | null;
  airstamp?: string | null;
  season?: number;
};

async function tmdbExternalIds(
  apiKey: string,
  tmdbTvId: number,
): Promise<{ imdb_id?: string; tvdb_id?: number | null }> {
  const url =
    `${TMDB_BASE}/tv/${tmdbTvId}/external_ids?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return {};
  return await res.json();
}

/** Resolve TVMaze show id from TMDB tv id via imdb / thetvdb lookup. */
export async function resolveTvmazeShowIdFromTmdb(
  tmdbTvId: number,
  apiKey: string,
): Promise<number | null> {
  try {
    const ext = await tmdbExternalIds(apiKey, tmdbTvId);
    const imdb = ext?.imdb_id ? String(ext.imdb_id).trim() : "";
    const tvdbRaw = ext?.tvdb_id;
    const tvdb =
      tvdbRaw !== undefined && tvdbRaw !== null && tvdbRaw !== ""
        ? Number(tvdbRaw)
        : NaN;

    const urls: string[] = [];
    if (imdb) {
      urls.push(tvmazeFetchUrl(`/lookup/shows?imdb=${encodeURIComponent(imdb)}`));
    }
    if (!Number.isNaN(tvdb)) {
      urls.push(tvmazeFetchUrl(`/lookup/shows?thetvdb=${tvdb}`));
    }

    for (const url of urls) {
      const res = await fetch(url, {
        headers: TVMAZE_HEADERS,
        redirect: "follow",
      });
      if (res.status === 404) continue;
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.id) return Number(data.id);
    }
  } catch (e) {
    console.error("resolveTvmazeShowIdFromTmdb:", e);
  }
  return null;
}

/** Episodes for one season from TVMaze. */
export async function fetchTvmazeSeasonEpisodes(
  mazeShowId: number,
  seasonNumber: number,
): Promise<TvmazeEpisodeRow[]> {
  const seasonsRes = await fetch(tvmazeFetchUrl(`/shows/${mazeShowId}/seasons`), {
    headers: TVMAZE_HEADERS,
  });
  if (!seasonsRes.ok) return [];

  const seasons = await seasonsRes.json();
  const seasonMeta = Array.isArray(seasons)
    ? seasons.find((s: { number?: number }) => s.number === seasonNumber)
    : null;
  if (!seasonMeta?.id) return [];

  const epRes = await fetch(tvmazeFetchUrl(`/seasons/${seasonMeta.id}/episodes`), {
    headers: TVMAZE_HEADERS,
  });
  if (!epRes.ok) return [];

  const raw = await epRes.json();
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((e: { number?: number }) => typeof e.number === "number")
    .map((e: {
      number: number;
      name?: string;
      airdate?: string | null;
      airstamp?: string | null;
    }) => ({
      number: e.number,
      name: e.name,
      airdate: e.airdate ?? null,
      airstamp: e.airstamp ?? null,
      season: seasonNumber,
    }));
}

/** Upcoming episodes across recent seasons (for ingestion). */
export async function fetchUpcomingTvmazeEpisodes(
  tmdbTvId: number,
  apiKey: string,
  maxEpisodes = 4,
): Promise<TvmazeEpisodeRow[]> {
  const mazeId = await resolveTvmazeShowIdFromTmdb(tmdbTvId, apiKey);
  if (!mazeId) return [];

  const showRes = await fetch(tvmazeFetchUrl(`/shows/${mazeId}`), {
    headers: TVMAZE_HEADERS,
  });
  if (!showRes.ok) return [];

  const show = await showRes.json();
  const seasonsRes = await fetch(tvmazeFetchUrl(`/shows/${mazeId}/seasons`), {
    headers: TVMAZE_HEADERS,
  });
  if (!seasonsRes.ok) return [];

  const seasons = (await seasonsRes.json()) as Array<{
    number?: number;
    premiereDate?: string | null;
  }>;
  const seasonNumbers = (Array.isArray(seasons) ? seasons : [])
    .map((s) => s.number)
    .filter((n): n is number => typeof n === "number" && n > 0)
    .sort((a, b) => b - a);

  const now = Date.now();
  const collected: TvmazeEpisodeRow[] = [];

  for (const sn of seasonNumbers.slice(0, 3)) {
    const eps = await fetchTvmazeSeasonEpisodes(mazeId, sn);
    for (const ep of eps) {
      const stamp = ep.airstamp ?? ep.airdate;
      if (!stamp) continue;
      const t = new Date(stamp).getTime();
      if (Number.isNaN(t) || t < now - 86400000) continue;
      collected.push(ep);
    }
    if (collected.length >= maxEpisodes) break;
  }

  collected.sort((a, b) => {
    const ta = new Date(a.airstamp ?? a.airdate ?? 0).getTime();
    const tb = new Date(b.airstamp ?? b.airdate ?? 0).getTime();
    return ta - tb;
  });

  return collected.slice(0, maxEpisodes);
}
