/**
 * In-app notification copy for release_reminder (matches notification-scenarios.md).
 */

export type ReleaseNotifyPayload = {
  title: string;
  message: string;
  link: string;
};

export function buildWishlistReleaseCopyWithLink(
  showTitle: string,
  mediaType: "movie" | "tv",
  offset: number,
  link: string,
): ReleaseNotifyPayload {
  const isMovie = mediaType === "movie";
  const movieWhen =
    offset === 0
      ? "is in theatres today (CA)"
      : offset === 1
      ? "opens in theatres tomorrow (CA)"
      : `opens in theatres in ${offset} days (CA)`;
  const tvWhen =
    offset === 0
      ? "premieres today (CA)"
      : offset === 1
      ? "premieres tomorrow (CA)"
      : `premieres in ${offset} days (CA)`;
  return {
    title: isMovie ? `In theatres: ${showTitle}` : `Premiere: ${showTitle}`,
    message: isMovie
      ? `"${showTitle}" ${movieWhen}.`
      : `"${showTitle}" ${tvWhen}.`,
    link,
  };
}

export function buildWatchingEpisodeCopy(
  showTitle: string,
  offset: number,
  link: string,
  episodeCount = 1,
): ReleaseNotifyPayload {
  const what = episodeCount > 1 ? `${episodeCount} new episodes` : "a new episode";
  const epWhen =
    offset === 0
      ? `has ${what} airing today (CA)`
      : offset === 1
      ? `has ${what} airing tomorrow (CA)`
      : `has ${what} in ${offset} days (CA)`;
  return {
    title: episodeCount > 1 ? `New episodes: ${showTitle}` : `New episode: ${showTitle}`,
    message: `"${showTitle}" ${epWhen}.`,
    link,
  };
}

export function wishlistDedupeKey(
  userId: string,
  contentId: number,
  mediaType: string,
  releaseKey: string,
  offset: number,
): string {
  return `rel:${userId}:${contentId}:${mediaType}:${releaseKey}:${offset}`;
}

export function watchingDedupeKey(
  userId: string,
  contentId: number,
  releaseKey: string,
  offset: number,
): string {
  return `rel:${userId}:${contentId}:tv:${releaseKey}:${offset}:w`;
}

/**
 * Release-key segments are identity only (never the date): a reschedule then updates the pending
 * queue row in place instead of inserting a second one. Stale rows are removed by precompute.
 */
export function releaseKeyForMovie(): string {
  return "release";
}

export function releaseKeyForEpisode(season: number, episode: number): string {
  return `s${season}e${episode}`;
}

/** Wishlist TV: one premiere reminder per show per season premiere (episode 1). */
export function releaseKeyForWishlistTv(showId: number, season: number): string {
  return `show:${showId}:s${season}`;
}

/** Parse `rel:{user}:{contentId}:{mediaType}:...` (`:w` suffix = watching reminder). */
export function parseReleaseDedupeKey(
  key: string,
): { userId: string; contentId: number; mediaType: string; watching: boolean } | null {
  const parts = key.split(":");
  if (parts[0] !== "rel" || parts.length < 5) return null;
  const contentId = Number(parts[2]);
  if (!Number.isFinite(contentId)) return null;
  return {
    userId: parts[1],
    contentId,
    mediaType: parts[3],
    watching: parts[parts.length - 1] === "w",
  };
}
