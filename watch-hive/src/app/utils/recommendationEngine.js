import { fetchTMDB } from '../api/utils';
import { calculateSimilarity } from './similarTitles';

/**
 * Word-token overlap similarity between two overviews (Jaccard).
 * Returns value in [0, 1]. Use only when both overviews are non-empty.
 */
function overviewSimilarity(overview1, overview2) {
    if (!overview1 || !overview2 || typeof overview1 !== 'string' || typeof overview2 !== 'string') {
        return 0;
    }
    const tokenize = (s) => {
        return [...new Set(
            s.toLowerCase()
                .replace(/\s+/g, ' ')
                .split(/\W+/)
                .filter((w) => w.length >= 2)
        )];
    };
    const a = new Set(tokenize(overview1));
    const b = new Set(tokenize(overview2));
    if (a.size === 0 && b.size === 0) return 0;
    const intersection = [...a].filter((x) => b.has(x)).length;
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Fetches a title's profile from TMDB: genres, keywords, title, overview, and for movies collection.
 * Pass `existingGenres` to skip the detail fetch; pass `existingDetails` to avoid refetching details when caller already has them.
 */
export async function fetchTitleProfile(titleId, mediaType, { existingGenres, existingDetails } = {}) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    const skipDetails = !!existingDetails || (!!existingGenres && !existingDetails);

    const [details, keywordsData] = await Promise.all([
        skipDetails
            ? Promise.resolve(null)
            : fetchTMDB(`/${type}/${titleId}`, { language: 'en-CA' }),
        fetchTMDB(`/${type}/${titleId}/keywords`).catch(() => null),
    ]);

    const resolvedDetails = existingDetails || details || null;

    const genreIds = existingGenres
        ? existingGenres.map((g) => (typeof g === 'object' ? g.id : g))
        : (resolvedDetails?.genres || []).map((g) => g.id);

    const rawKeywords = mediaType === 'movie'
        ? keywordsData?.keywords || []
        : keywordsData?.results || [];

    const keywordIds = rawKeywords.slice(0, 10).map((k) => k.id);

    const title = resolvedDetails ? (type === 'movie' ? resolvedDetails.title : resolvedDetails.name) : '';
    const overview = resolvedDetails?.overview ?? '';

    let collectionMovieIds = [];
    let collectionParts = [];

    if (type === 'movie' && resolvedDetails?.belongs_to_collection?.id) {
        try {
            const collection = await fetchTMDB(`/collection/${resolvedDetails.belongs_to_collection.id}`, { language: 'en-CA' });
            const parts = collection?.parts || [];
            collectionMovieIds = parts.map((p) => p.id);
            collectionParts = parts;
        } catch {
            collectionMovieIds = [];
            collectionParts = [];
        }
    }

    return {
        titleId,
        mediaType: type,
        genreIds,
        keywordIds,
        title: title || '',
        overview: overview || '',
        collectionMovieIds,
        collectionParts,
        voteAverage: resolvedDetails?.vote_average ?? 0,
        popularity: resolvedDetails?.popularity ?? 0,
    };
}

/**
 * Merges multiple title profiles into a single combined profile.
 * Genre and keyword IDs are ranked by frequency; titles, overviews, and collection data are merged.
 */
export function mergeProfiles(profiles) {
    const genreFreq = new Map();
    const keywordFreq = new Map();
    const titles = [];
    const overviews = [];
    const collectionMovieIdsSet = new Set();
    const collectionPartsById = new Map();

    for (const p of profiles) {
        for (const gid of p.genreIds) {
            genreFreq.set(gid, (genreFreq.get(gid) || 0) + 1);
        }
        for (const kid of p.keywordIds) {
            keywordFreq.set(kid, (keywordFreq.get(kid) || 0) + 1);
        }
        if (p.title) titles.push(p.title);
        if (p.overview) overviews.push(p.overview);
        for (const id of p.collectionMovieIds || []) {
            collectionMovieIdsSet.add(id);
        }
        for (const part of p.collectionParts || []) {
            if (part?.id) collectionPartsById.set(part.id, part);
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
        titles,
        overviews,
        collectionMovieIds: [...collectionMovieIdsSet],
        collectionParts: [...collectionPartsById.values()],
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

const GENRE_SCORE_MAX = 10;
const OVERVIEW_SCORE_MAX = 7;
const NAME_SCORE_MAX = 3;
const COLLECTION_BONUS = 5;

/**
 * Similarity-based scoring.
 * Priority order: keywords (via discover filter), genre, overview, title, collection bonus, vote, popularity.
 */
export function scoreResults(results, sourceProfile) {
    const sourceGenreSet = new Set(sourceProfile.genreIds);
    const sourceGenreCount = sourceGenreSet.size || 1;
    const sourceTitles = sourceProfile.titles?.length
        ? sourceProfile.titles
        : sourceProfile.title != null
            ? [sourceProfile.title]
            : [];
    const sourceOverviews = sourceProfile.overviews?.length
        ? sourceProfile.overviews
        : sourceProfile.overview != null
            ? [sourceProfile.overview]
            : [];
    const collectionMovieIdsSet = new Set(sourceProfile.collectionMovieIds || []);

    return results
        .map((item) => {
            const itemGenres = item.genre_ids || [];
            const matchingGenres = itemGenres.filter((g) => sourceGenreSet.has(g)).length;
            const genreScore = (matchingGenres / sourceGenreCount) * GENRE_SCORE_MAX;

            const itemOverview = item.overview || '';
            const overviewSim = sourceOverviews.length && itemOverview
                ? Math.max(...sourceOverviews.map((o) => overviewSimilarity(o, itemOverview)))
                : 0;
            const overviewScore = overviewSim * OVERVIEW_SCORE_MAX;

            const itemTitle = item.title || item.name || '';
            const nameSimilarity = sourceTitles.length
                ? Math.max(...sourceTitles.map((t) => calculateSimilarity(t, itemTitle)))
                : 0;
            const nameScore = nameSimilarity * NAME_SCORE_MAX;

            const collectionBonus =
                collectionMovieIdsSet.has(item.id) ? COLLECTION_BONUS : 0;

            const voteScore = item.vote_average || 0;
            const popularityScore =
                item.popularity > 0 ? Math.min(Math.log10(item.popularity), 3) : 0;

            const finalScore =
                genreScore + overviewScore + nameScore + collectionBonus + voteScore + popularityScore;

            return { ...item, _score: Math.round(finalScore * 100) / 100 };
        })
        .sort((a, b) => b._score - a._score);
}

/**
 * Full recommendation flow for a single title.
 * Fetches profile, queries discover, merges same-collection movies (movies only), scores, and returns filtered results.
 */
export async function getDiscoverRecommendations(
    titleId,
    mediaType,
    { existingGenres, existingDetails, excludeIds = [], limit = 20 } = {}
) {
    const profile = await fetchTitleProfile(titleId, mediaType, { existingGenres, existingDetails });
    const type = mediaType === 'movie' ? 'movie' : 'tv';

    const excludeSet = new Set([Number(titleId), ...excludeIds.map(Number)]);

    const params = buildDiscoverParams(profile, type);
    const [page1, page2] = await Promise.all([
        fetchTMDB(`/discover/${type}`, { ...params, page: 1 }),
        fetchTMDB(`/discover/${type}`, { ...params, page: 2 }).catch(() => ({ results: [] })),
    ]);

    let allResults = [...(page1.results || []), ...(page2.results || [])].filter((item) =>
        !excludeSet.has(item.id)
    );

    if (type === 'movie' && profile.collectionParts?.length) {
        const discoverIds = new Set(allResults.map((r) => r.id));
        for (const part of profile.collectionParts) {
            if (part.id && !excludeSet.has(part.id) && !discoverIds.has(part.id)) {
                discoverIds.add(part.id);
                allResults.push(part);
            }
        }
    }

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
    let allResults = pages
        .flatMap((p) => p.results || [])
        .filter((item) => !excludeSet.has(item.id));

    if (discoverTypes.includes('movie') && merged.collectionParts?.length) {
        const resultIds = new Set(allResults.map((r) => r.id));
        for (const part of merged.collectionParts) {
            if (part.id && !excludeSet.has(part.id) && !resultIds.has(part.id)) {
                resultIds.add(part.id);
                allResults.push({ ...part, media_type: 'movie' });
            }
        }
    }

    const seenIds = new Set();
    const unique = allResults.filter((item) => {
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
