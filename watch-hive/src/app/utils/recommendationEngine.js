import { fetchTMDB } from '../api/utils';

/**
 * Fetches a title's genre IDs and keyword IDs from TMDB.
 * If the title details are already available (genres array), pass them
 * via `existingGenres` to skip the detail fetch.
 */
export async function fetchTitleProfile(titleId, mediaType, { existingGenres } = {}) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';

    const [details, keywordsData] = await Promise.all([
        existingGenres
            ? Promise.resolve(null)
            : fetchTMDB(`/${type}/${titleId}`, { language: 'en-CA' }),
        fetchTMDB(`/${type}/${titleId}/keywords`).catch(() => null),
    ]);

    const genreIds = existingGenres
        ? existingGenres.map(g => (typeof g === 'object' ? g.id : g))
        : (details?.genres || []).map(g => g.id);

    const rawKeywords = mediaType === 'movie'
        ? keywordsData?.keywords || []
        : keywordsData?.results || [];

    const keywordIds = rawKeywords.slice(0, 10).map(k => k.id);

    return {
        titleId,
        mediaType: type,
        genreIds,
        keywordIds,
        voteAverage: details?.vote_average ?? 0,
        popularity: details?.popularity ?? 0,
    };
}

/**
 * Merges multiple title profiles into a single combined profile.
 * Genre and keyword IDs are ranked by frequency across sources.
 */
export function mergeProfiles(profiles) {
    const genreFreq = new Map();
    const keywordFreq = new Map();

    for (const p of profiles) {
        for (const gid of p.genreIds) {
            genreFreq.set(gid, (genreFreq.get(gid) || 0) + 1);
        }
        for (const kid of p.keywordIds) {
            keywordFreq.set(kid, (keywordFreq.get(kid) || 0) + 1);
        }
    }

    const sortedGenres = [...genreFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);

    const sortedKeywords = [...keywordFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
        .slice(0, 10);

    return {
        genreIds: sortedGenres,
        keywordIds: sortedKeywords,
    };
}

/**
 * Builds TMDB discover query params from a profile.
 * Uses OR logic (pipe-separated) so results match ANY of the genres/keywords.
 */
export function buildDiscoverParams(profile, mediaType, options = {}) {
    const {
        page = 1,
        sortBy = 'popularity.desc',
        voteCountMin = 50,
        language = 'en-CA',
    } = options;

    const params = {
        language,
        page,
        sort_by: sortBy,
        include_adult: false,
        'vote_count.gte': voteCountMin,
    };

    if (profile.genreIds.length > 0) {
        params.with_genres = profile.genreIds.join('|');
    }

    if (profile.keywordIds.length > 0) {
        params.with_keywords = profile.keywordIds.slice(0, 5).join('|');
    }

    return params;
}

/**
 * Linear scoring: ranks discover results by how well they match the source profile.
 *
 * genreScore   = (matching genres / source genres) * 10    [0-10]
 * voteScore    = vote_average                               [0-10]
 * popularityScore = min(log10(popularity), 3)               [0-3]
 * ──────────────────────────────────────────────────────────
 * finalScore   = genreScore + voteScore + popularityScore   [0-23]
 */
export function scoreResults(results, sourceProfile) {
    const sourceGenreSet = new Set(sourceProfile.genreIds);
    const sourceGenreCount = sourceGenreSet.size || 1;

    return results
        .map(item => {
            const itemGenres = item.genre_ids || [];
            const matchingGenres = itemGenres.filter(g => sourceGenreSet.has(g)).length;

            const genreScore = (matchingGenres / sourceGenreCount) * 10;
            const voteScore = item.vote_average || 0;
            const popularityScore = item.popularity > 0
                ? Math.min(Math.log10(item.popularity), 3)
                : 0;

            const finalScore = genreScore + voteScore + popularityScore;

            return { ...item, _score: Math.round(finalScore * 100) / 100 };
        })
        .sort((a, b) => b._score - a._score);
}

/**
 * Full recommendation flow for a single title.
 * Fetches profile, queries discover, scores, and returns filtered results.
 */
export async function getDiscoverRecommendations(
    titleId,
    mediaType,
    { existingGenres, excludeIds = [], limit = 20 } = {}
) {
    const profile = await fetchTitleProfile(titleId, mediaType, { existingGenres });
    const type = mediaType === 'movie' ? 'movie' : 'tv';

    const excludeSet = new Set([Number(titleId), ...excludeIds.map(Number)]);

    const params = buildDiscoverParams(profile, type);
    const [page1, page2] = await Promise.all([
        fetchTMDB(`/discover/${type}`, { ...params, page: 1 }),
        fetchTMDB(`/discover/${type}`, { ...params, page: 2 }).catch(() => ({ results: [] })),
    ]);

    const allResults = [...(page1.results || []), ...(page2.results || [])]
        .filter(item => !excludeSet.has(item.id));

    const scored = scoreResults(allResults, profile);
    return scored.slice(0, limit);
}

/**
 * Multi-title recommendation flow (Content Mixer).
 * Merges profiles from multiple titles, then discovers + scores.
 */
export async function getMultiTitleRecommendations(
    movieIds = [],
    seriesIds = [],
    { limit = 20 } = {}
) {
    const profilePromises = [
        ...movieIds.map(id => fetchTitleProfile(id, 'movie')),
        ...seriesIds.map(id => fetchTitleProfile(id, 'tv')),
    ];

    const profiles = await Promise.all(profilePromises);
    const merged = mergeProfiles(profiles);
    const excludeSet = new Set([...movieIds, ...seriesIds].map(Number));

    const discoverTypes = [];
    if (movieIds.length > 0 && seriesIds.length === 0) {
        discoverTypes.push('movie');
    } else if (seriesIds.length > 0 && movieIds.length === 0) {
        discoverTypes.push('tv');
    } else {
        discoverTypes.push('movie', 'tv');
    }

    const fetchPromises = discoverTypes.flatMap(type => {
        const params = buildDiscoverParams(merged, type);
        return [
            fetchTMDB(`/discover/${type}`, { ...params, page: 1 }),
            fetchTMDB(`/discover/${type}`, { ...params, page: 2 }).catch(() => ({ results: [] })),
        ];
    });

    const pages = await Promise.all(fetchPromises);
    const allResults = pages
        .flatMap(p => p.results || [])
        .filter(item => !excludeSet.has(item.id));

    const seenIds = new Set();
    const unique = allResults.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
    });

    const scored = scoreResults(unique, merged);

    return scored.slice(0, limit).map(item => ({
        ...item,
        media_type: item.media_type || (discoverTypes.length === 1 ? discoverTypes[0] : undefined),
    }));
}
