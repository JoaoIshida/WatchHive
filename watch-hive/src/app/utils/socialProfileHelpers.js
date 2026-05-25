import { getMockListPosterPaths, isMockListId } from './mockPublicLists';

export const TMDB_POSTER = (path) =>
    path ? `https://image.tmdb.org/t/p/w200${path}` : null;

export const TMDB_BACKDROP = (path) =>
    path ? `https://image.tmdb.org/t/p/w780${path}` : null;

export const LABEL_MAX_LEN = 15;

export function truncateLabel(text, maxLen = LABEL_MAX_LEN) {
    if (!text || text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}...`;
}

export function postersFromListItems(items) {
    return (items || [])
        .slice(0, 3)
        .map((item) => item.details?.poster_path || item.details?.backdrop_path)
        .filter(Boolean);
}

export function enrichListSummariesWithPosters(lists) {
    return (lists || []).map((list) => {
        if (Array.isArray(list.posters) && list.posters.length > 0) {
            return list;
        }
        if (isMockListId(list.id)) {
            return { ...list, posters: getMockListPosterPaths(list.id) };
        }
        return { ...list, posters: list.posters || [] };
    });
}

export function enrichProfileForDisplay(profile) {
    if (!profile) return profile;
    return {
        ...profile,
        public_lists: enrichListSummariesWithPosters(profile.public_lists),
        shared_with_you: enrichListSummariesWithPosters(profile.shared_with_you),
    };
}

export function collectHeroPosterPaths(profile) {
    const paths = [];
    const allLists = [
        ...(profile?.shared_with_you || []),
        ...(profile?.public_lists || []),
    ];
    for (const list of allLists) {
        for (const p of list.posters || []) {
            paths.push(p);
            if (paths.length >= 6) return paths;
        }
    }
    return paths;
}
