const TMDB_BASE = "https://api.themoviedb.org/3";

export async function fetchTvCatalogTotals(
  seriesId: number,
  apiKey: string,
): Promise<{ totalEpisodes: number; name: string | null }> {
  const url = `${TMDB_BASE}/tv/${seriesId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TMDB tv/${seriesId}: ${res.status} ${t.slice(0, 200)}`);
  }
  const tv = await res.json();
  // TMDB season 0 = specials; never include in catalog_total_episodes
  const seasons = (tv.seasons || []) as Array<{ season_number: number; episode_count?: number }>;
  let totalEpisodes = 0;
  for (const s of seasons) {
    if (s.season_number <= 0) continue;
    totalEpisodes += s.episode_count ?? 0;
  }
  const name = typeof tv.name === "string" ? tv.name : null;
  return { totalEpisodes, name };
}

export type TmdbReleaseRow = {
  title: string;
  release_date: string | null;
  poster_path: string | null;
};

/** Movie details + Canada release date when available (falls back to primary release_date). */
export async function tmdbMovieCa(
  apiKey: string,
  movieId: number,
): Promise<TmdbReleaseRow> {
  const base = `${TMDB_BASE}/movie/${movieId}`;
  const key = encodeURIComponent(apiKey);
  const [detailRes, datesRes] = await Promise.all([
    fetch(`${base}?api_key=${key}`, { headers: { Accept: "application/json" } }),
    fetch(`${base}/release_dates?api_key=${key}`, {
      headers: { Accept: "application/json" },
    }),
  ]);
  if (!detailRes.ok) {
    const t = await detailRes.text();
    throw new Error(`TMDB movie/${movieId}: ${detailRes.status} ${t.slice(0, 200)}`);
  }
  const movie = await detailRes.json();
  const title = typeof movie.title === "string" ? movie.title : `Movie ${movieId}`;
  const poster_path = typeof movie.poster_path === "string" ? movie.poster_path : null;
  let release_date: string | null = null;
  if (datesRes.ok) {
    const dates = await datesRes.json();
    const ca = (dates.results || []).find(
      (r: { iso_3166_1?: string }) => r.iso_3166_1 === "CA",
    );
    const entries = ca?.release_dates as Array<{ release_date?: string }> | undefined;
    const first = entries?.[0];
    if (first?.release_date) {
      release_date = String(first.release_date).slice(0, 10);
    }
  }
  if (
    !release_date &&
    typeof movie.release_date === "string" &&
    movie.release_date.length > 0
  ) {
    release_date = movie.release_date.slice(0, 10);
  }
  return { title, release_date, poster_path };
}

export type TmdbNextEpisode = {
  air_date: string | null;
  season_number: number | null;
  episode_number: number | null;
};

/** TV series: next episode air date from TMDB (null if none scheduled). */
export async function tmdbTvNextAir(
  apiKey: string,
  seriesId: number,
): Promise<TmdbReleaseRow & { next?: TmdbNextEpisode | null }> {
  const url = `${TMDB_BASE}/tv/${seriesId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TMDB tv/${seriesId}: ${res.status} ${t.slice(0, 200)}`);
  }
  const tv = await res.json();
  const title = typeof tv.name === "string" ? tv.name : `Series ${seriesId}`;
  const poster_path = typeof tv.poster_path === "string" ? tv.poster_path : null;
  const next = tv.next_episode_to_air as {
    air_date?: string;
    season_number?: number;
    episode_number?: number;
  } | null | undefined;
  let release_date: string | null = null;
  let nextEp: TmdbNextEpisode | null = null;
  if (next) {
    if (typeof next.air_date === "string" && next.air_date.length > 0) {
      release_date = next.air_date.slice(0, 10);
    }
    nextEp = {
      air_date: release_date,
      season_number:
        typeof next.season_number === "number" ? next.season_number : null,
      episode_number:
        typeof next.episode_number === "number" ? next.episode_number : null,
    };
  }
  return { title, release_date, poster_path, next: nextEp };
}
