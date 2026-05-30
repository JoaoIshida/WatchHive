const STORAGE_KEY = 'watchhive:ai-search-session';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function loadAiSearchSession() {
    if (typeof window === 'undefined') return null;

    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed?.savedAt || Date.now() - parsed.savedAt > SESSION_TTL_MS) {
            sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return {
            query: typeof parsed.query === 'string' ? parsed.query : '',
            mediaType: parsed.mediaType === 'movie' || parsed.mediaType === 'tv' ? parsed.mediaType : 'both',
            results: Array.isArray(parsed.results) ? parsed.results : [],
            visibleCount: Number.isFinite(parsed.visibleCount) ? parsed.visibleCount : 8,
            canLoadMore: parsed.canLoadMore === true,
            activeQuery: typeof parsed.activeQuery === 'string' ? parsed.activeQuery : '',
            hasSearched: parsed.hasSearched === true,
        };
    } catch {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

export function saveAiSearchSession(session) {
    if (typeof window === 'undefined') return;

    try {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                ...session,
                savedAt: Date.now(),
            })
        );
    } catch {
        // ignore quota / private mode errors
    }
}

export function clearAiSearchSession() {
    if (typeof window === 'undefined') return;

    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
