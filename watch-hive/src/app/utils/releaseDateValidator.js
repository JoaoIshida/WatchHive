/**
 * Check if a date is in the future (not yet released)
 */
export function isUnreleased(dateString) {
    if (!dateString) return false; // If no date, assume it's released (callers rarely pass unset here)

    try {
        const releaseDate = new Date(dateString);
        releaseDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return releaseDate > today;
    } catch {
        return false;
    }
}

/**
 * Check if a movie is released
 */
export function isMovieReleased(movie) {
    if (!movie) return false;
    return !isUnreleased(movie.release_date);
}

/**
 * Check if a series is released
 */
export function isSeriesReleased(series) {
    if (!series) return false;
    return !isUnreleased(series.first_air_date);
}

/**
 * Check if a season is released
 */
export function isSeasonReleased(season) {
    if (!season) return false;
    return !isUnreleased(season.air_date);
}

function seasonEpisodeCountApprox(seasonData) {
    if (!seasonData) return null;
    if (typeof seasonData.episode_count === 'number' && seasonData.episode_count >= 0) {
        return seasonData.episode_count;
    }
    const eps = seasonData.episodes;
    if (Array.isArray(eps)) return eps.length;
    return null;
}

/**
 * Check if an episode is released (eligible to mark watched).
 *
 * @param episode TMDB `/tv/{id}/season/{sn}` episode object
 * @param seasonData TMDB season object (episode list + poster + premiere + episode_count…)
 * @param scheduleEp optional TV Maze `{ airstamp?, airdate? }` for this episode — **preferred**
 *        when present so UI/network dates match what we display from TV Maze.
 */
export function isEpisodeReleased(episode, seasonData = null, scheduleEp = null) {
    if (!episode) return false;

    /** 1 — TV schedule (same source often shown beside the toggle) */
    if (scheduleEp) {
        if (scheduleEp.airstamp) {
            try {
                const t = Date.parse(String(scheduleEp.airstamp));
                if (!Number.isNaN(t)) return t <= Date.now();
            } catch {
                /* fall through */
            }
        }
        if (scheduleEp.airdate) {
            const d = String(scheduleEp.airdate).slice(0, 10);
            if (d) return !isUnreleased(d);
        }
        /* Schedule object present but no parsable timing — defer to TMDB below. */
    }

    /** 2 — TMDB per-episode premiere date */
    let airDate = episode.air_date;

    /** 3 — Season premiere fallback only when that season truly has ≤1 scripted episode slots (avoids weekly eps inheriting S3E1 date) */
    if (!airDate && seasonData?.air_date) {
        const ec = seasonEpisodeCountApprox(seasonData);
        const list = Array.isArray(seasonData.episodes) ? seasonData.episodes.length : null;
        const inferredCount = typeof ec === 'number' && ec > 0 ? ec : list;
        if ((inferredCount != null && inferredCount <= 1) || (list != null && list <= 1)) {
            airDate = seasonData.air_date;
        }
    }

    /** 4 — No credible date ⇒ not released yet (fixes “everything without TMDB dates == watchable”). */
    if (!airDate) {
        return false;
    }

    return !isUnreleased(airDate);
}

function pickScheduleEntry(scheduleMap, episodeNumber) {
    if (scheduleMap == null) return null;
    if (typeof scheduleMap.get === 'function') {
        return scheduleMap.get(episodeNumber) ?? null;
    }
    return scheduleMap[episodeNumber] ?? null;
}

/**
 * Same as {@link isEpisodeReleased}, plus a **linear air order** gate: for regular episodes
 * (episode_number ≥ 1), every lower-numbered episode in `seasonData.episodes` must already
 * count as released. Stops TMDB wrong dates on E2+ when TV Maze (or TMDB) shows E1 still future.
 *
 * @param scheduleMap TV Maze rows keyed by episode number: `Map<number, { airdate?, airstamp? }>`
 *        or a plain object `{ [episodeNumber]: … }` (same shape as client `tvmazeEpisodes[sn]`).
 */
export function isEpisodeReleasedOrdered(episode, seasonData = null, scheduleMap = null) {
    if (!episode) return false;

    const n = episode.episode_number;
    if (typeof n !== 'number' || n <= 0) {
        return isEpisodeReleased(episode, seasonData, pickScheduleEntry(scheduleMap, n));
    }

    const eps = Array.isArray(seasonData?.episodes) ? seasonData.episodes : [];
    for (const prior of eps) {
        const pn = prior?.episode_number;
        if (typeof pn !== 'number' || pn <= 0 || pn >= n) continue;
        if (!isEpisodeReleased(prior, seasonData, pickScheduleEntry(scheduleMap, pn))) {
            return false;
        }
    }

    return isEpisodeReleased(episode, seasonData, pickScheduleEntry(scheduleMap, n));
}
