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
  const seasons = (tv.seasons || []) as Array<{ season_number: number; episode_count?: number }>;
  let totalEpisodes = 0;
  for (const s of seasons) {
    if (s.season_number <= 0) continue;
    totalEpisodes += s.episode_count ?? 0;
  }
  const name = typeof tv.name === "string" ? tv.name : null;
  return { totalEpisodes, name };
}
