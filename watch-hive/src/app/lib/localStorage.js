const STORAGE_KEYS = {
    RECENT_SEARCHES: 'watchhive_recent_searches',
};

/** Max age for a recent search entry (7 days). Entries older than this are filtered out when reading. */
const RECENT_SEARCHES_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_SEARCHES_MAX_ITEMS = 10;

// Recent searches (expire per item after RECENT_SEARCHES_MAX_AGE_MS)
export const recentSearchesStorage = {
    getAll: () => {
        if (typeof window === 'undefined') return [];
        try {
            const data = localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
            const raw = data ? JSON.parse(data) : [];
            if (!Array.isArray(raw)) return [];
            const now = Date.now();
            const valid = raw.filter((entry) => now - (entry.timestamp || 0) < RECENT_SEARCHES_MAX_AGE_MS);
            if (valid.length !== raw.length) {
                localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(valid));
            }
            return valid.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } catch {
            return [];
        }
    },

    add: (query) => {
        if (typeof window === 'undefined') return;
        const trimmed = (query || '').trim();
        if (!trimmed) return;
        let list = recentSearchesStorage.getAll();
        list = list.filter((e) => e.query.toLowerCase() !== trimmed.toLowerCase());
        list.unshift({ query: trimmed, timestamp: Date.now() });
        list = list.slice(0, RECENT_SEARCHES_MAX_ITEMS);
        localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(list));
    },

    remove: (query) => {
        if (typeof window === 'undefined') return;
        const list = recentSearchesStorage.getAll().filter(
            (e) => e.query.toLowerCase() !== (query || '').trim().toLowerCase()
        );
        localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(list));
    },
};
