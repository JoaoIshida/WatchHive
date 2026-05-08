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
    if (movie.release_date) {
        return !isUnreleased(movie.release_date);
    }
    if (String(movie.status || '') === 'Released') {
        return true;
    }
    return false;
}

/**
 * Check if a series is released (has premiered or clearly finished catalog on TMDB)
 */
export function isSeriesReleased(series) {
    if (!series) return false;
    if (series.first_air_date) {
        return !isUnreleased(series.first_air_date);
    }
    const st = String(series.status || '');
    if ((st === 'Ended' || st === 'Canceled') && series.last_air_date && !isUnreleased(series.last_air_date)) {
        return true;
    }
    return false;
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
 * Slim TMDB `/tv/{id}` fields used when an episode has no TV Maze / TMDB air date.
 *
 * @param {object|null|undefined} tv
 * @returns {{ status: string|null, last_air_date: string|null, last_episode_to_air: object|null, next_episode_to_air: object|null }|null}
 */
export function buildSeriesTvReleaseMeta(tv) {
    if (!tv || typeof tv !== 'object') return null;
    return {
        status: tv.status != null ? String(tv.status) : null,
        last_air_date: tv.last_air_date != null ? String(tv.last_air_date) : null,
        last_episode_to_air: tv.last_episode_to_air ?? null,
        next_episode_to_air: tv.next_episode_to_air ?? null,
    };
}

function compareSeasonEpisodeOrder(seasonA, epA, seasonB, epB) {
    if (
        typeof seasonA !== 'number' ||
        typeof epA !== 'number' ||
        typeof seasonB !== 'number' ||
        typeof epB !== 'number'
    ) {
        return null;
    }
    if (seasonA !== seasonB) return seasonA - seasonB;
    return epA - epB;
}

/**
 * When TV Maze has no schedule date and TMDB has no episode `air_date`, infer that the episode
 * has already aired using TMDB's last-aired anchor (and ended/canceled lifecycle).
 */
function inferReleasedFromSeriesTvMeta(episode, seasonData, seriesTvMeta) {
    if (!seriesTvMeta || !episode) return false;

    const seasonNumber =
        typeof seasonData?.season_number === 'number'
            ? seasonData.season_number
            : typeof episode.season_number === 'number'
              ? episode.season_number
              : null;
    const epNum = typeof episode.episode_number === 'number' ? episode.episode_number : null;
    if (seasonNumber === null || epNum === null) return false;

    const last = seriesTvMeta.last_episode_to_air;
    if (last && typeof last.season_number === 'number' && typeof last.episode_number === 'number') {
        const ord = compareSeasonEpisodeOrder(seasonNumber, epNum, last.season_number, last.episode_number);
        if (ord !== null && ord <= 0) {
            return true;
        }
    }

    return false;
}

/**
 * Check if an episode is released (eligible to mark watched).
 *
 * @param episode TMDB `/tv/{id}/season/{sn}` episode object
 * @param seasonData TMDB season object (episode list + poster + premiere + episode_count…)
 * @param scheduleEp optional TV Maze `{ airstamp?, airdate? }` for this episode — **preferred**
 *        when it has a usable date; if it has no date, TMDB is used next, then series meta.
 * @param seriesTvMeta optional {@link buildSeriesTvReleaseMeta} from TMDB `/tv/{id}` when dates are missing.
 */
export function isEpisodeReleased(episode, seasonData = null, scheduleEp = null, seriesTvMeta = null) {
    if (!episode) return false;

    /** 1 — TV Maze schedule when it supplies a usable instant or calendar day */
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
        /* Row present but no parsable TV Maze date — fall through to TMDB / series meta. */
    }

    /** 2 — TMDB per-episode premiere date */
    let airDate = episode.air_date;

    /** 3 — Season premiere fallback only when that season truly has ≤1 scripted episode slots */
    if (!airDate && seasonData?.air_date) {
        const ec = seasonEpisodeCountApprox(seasonData);
        const list = Array.isArray(seasonData.episodes) ? seasonData.episodes.length : null;
        const inferredCount = typeof ec === 'number' && ec > 0 ? ec : list;
        if ((inferredCount != null && inferredCount <= 1) || (list != null && list <= 1)) {
            airDate = seasonData.air_date;
        }
    }

    if (airDate) {
        return !isUnreleased(airDate);
    }

    /** 4 — No episode/season date: infer from TMDB series status + last aired episode */
    if (inferReleasedFromSeriesTvMeta(episode, seasonData, seriesTvMeta)) {
        return true;
    }

    return false;
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
 * @param seriesTvMeta optional {@link buildSeriesTvReleaseMeta} from TMDB `/tv/{id}`.
 */
export function isEpisodeReleasedOrdered(episode, seasonData = null, scheduleMap = null, seriesTvMeta = null) {
    if (!episode) return false;

    const n = episode.episode_number;
    if (typeof n !== 'number' || n <= 0) {
        return isEpisodeReleased(episode, seasonData, pickScheduleEntry(scheduleMap, n), seriesTvMeta);
    }

    const eps = Array.isArray(seasonData?.episodes) ? seasonData.episodes : [];
    for (const prior of eps) {
        const pn = prior?.episode_number;
        if (typeof pn !== 'number' || pn <= 0 || pn >= n) continue;
        if (!isEpisodeReleased(prior, seasonData, pickScheduleEntry(scheduleMap, pn), seriesTvMeta)) {
            return false;
        }
    }

    return isEpisodeReleased(episode, seasonData, pickScheduleEntry(scheduleMap, n), seriesTvMeta);
}
