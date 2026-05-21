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
): ReleaseNotifyPayload {
  const epWhen =
    offset === 0
      ? "has a new episode airing today (CA)"
      : offset === 1
      ? "has a new episode airing tomorrow (CA)"
      : `has a new episode in ${offset} days (CA)`;
  return {
    title: `New episode: ${showTitle}`,
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

/** Stable key segment for movie (date) or TV episode (season-ep or date). */
export function releaseKeyForMovie(releaseDate: string): string {
  return releaseDate.slice(0, 10);
}

export function releaseKeyForEpisode(
  season: number,
  episode: number,
  releaseAtUtc: string,
): string {
  return `s${season}e${episode}:${releaseAtUtc.slice(0, 10)}`;
}
