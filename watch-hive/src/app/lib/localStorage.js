/**
 * Local Storage Utility for Mocking User Data
 * This is a temporary solution for testing features before implementing Supabase
 */

const STORAGE_KEYS = {
    WATCHED: 'watchhive_watched',
    WISHLIST: 'watchhive_wishlist',
    SERIES_PROGRESS: 'watchhive_series_progress',
    USER_PREFERENCES: 'watchhive_preferences',
    CUSTOM_LISTS: 'watchhive_custom_lists',
};

// Watched Movies/Series
export const watchedStorage = {
    getAll: () => {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(STORAGE_KEYS.WATCHED);
        return data ? JSON.parse(data) : [];
    },

    add: (itemId, mediaType, dateWatched = null) => {
        if (typeof window === 'undefined') return;
        const watched = watchedStorage.getAll();
        const existing = watched.find(w => w.id === itemId && w.mediaType === mediaType);
        
        if (!existing) {
            watched.push({
                id: itemId,
                mediaType,
                dateWatched: dateWatched || new Date().toISOString(),
                timesWatched: 1,
            });
        } else {
            existing.timesWatched = (existing.timesWatched || 1) + 1;
            existing.dateWatched = dateWatched || new Date().toISOString();
        }
        
        localStorage.setItem(STORAGE_KEYS.WATCHED, JSON.stringify(watched));
        return watched;
    },

    remove: (itemId, mediaType) => {
        if (typeof window === 'undefined') return;
        const watched = watchedStorage.getAll();
        const filtered = watched.filter(w => !(w.id === itemId && w.mediaType === mediaType));
        localStorage.setItem(STORAGE_KEYS.WATCHED, JSON.stringify(filtered));
        return filtered;
    },

    isWatched: (itemId, mediaType) => {
        const watched = watchedStorage.getAll();
        return watched.some(w => w.id === itemId && w.mediaType === mediaType);
    },

    getTimesWatched: (itemId, mediaType) => {
        const watched = watchedStorage.getAll();
        const item = watched.find(w => w.id === itemId && w.mediaType === mediaType);
        return item?.timesWatched || 0;
    },

    getCount: () => {
        return watchedStorage.getAll().length;
    },
};

// Wishlist
export const wishlistStorage = {
    getAll: () => {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(STORAGE_KEYS.WISHLIST);
        return data ? JSON.parse(data) : [];
    },

    add: (itemId, mediaType, dateAdded = null) => {
        if (typeof window === 'undefined') return;
        const wishlist = wishlistStorage.getAll();
        const exists = wishlist.some(w => w.id === itemId && w.mediaType === mediaType);
        
        if (!exists) {
            wishlist.push({
                id: itemId,
                mediaType,
                dateAdded: dateAdded || new Date().toISOString(),
            });
            localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(wishlist));
        }
        
        return wishlist;
    },

    remove: (itemId, mediaType) => {
        if (typeof window === 'undefined') return;
        const wishlist = wishlistStorage.getAll();
        const filtered = wishlist.filter(w => !(w.id === itemId && w.mediaType === mediaType));
        localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(filtered));
        return filtered;
    },

    isInWishlist: (itemId, mediaType) => {
        const wishlist = wishlistStorage.getAll();
        return wishlist.some(w => w.id === itemId && w.mediaType === mediaType);
    },

    getCount: () => {
        return wishlistStorage.getAll().length;
    },
};

// Series Progress (Seasons & Episodes)
export const seriesProgressStorage = {
    getAll: () => {
        if (typeof window === 'undefined') return {};
        const data = localStorage.getItem(STORAGE_KEYS.SERIES_PROGRESS);
        return data ? JSON.parse(data) : {};
    },

    getSeriesProgress: (seriesId) => {
        const all = seriesProgressStorage.getAll();
        return all[seriesId] || {
            seasons: {},
            completed: false,
            lastWatched: null,
        };
    },

    markEpisodeWatched: (seriesId, seasonNumber, episodeNumber) => {
        if (typeof window === 'undefined') return;
        const all = seriesProgressStorage.getAll();
        if (!all[seriesId]) {
            all[seriesId] = { seasons: {}, completed: false, lastWatched: null };
        }
        
        if (!all[seriesId].seasons[seasonNumber]) {
            all[seriesId].seasons[seasonNumber] = { episodes: [] };
        }
        
        if (!all[seriesId].seasons[seasonNumber].episodes.includes(episodeNumber)) {
            all[seriesId].seasons[seasonNumber].episodes.push(episodeNumber);
            all[seriesId].seasons[seasonNumber].episodes.sort((a, b) => a - b);
        }
        
        all[seriesId].lastWatched = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.SERIES_PROGRESS, JSON.stringify(all));
        return all[seriesId];
    },

    markEpisodeUnwatched: (seriesId, seasonNumber, episodeNumber) => {
        if (typeof window === 'undefined') return;
        const all = seriesProgressStorage.getAll();
        if (all[seriesId]?.seasons[seasonNumber]?.episodes) {
            all[seriesId].seasons[seasonNumber].episodes = 
                all[seriesId].seasons[seasonNumber].episodes.filter(e => e !== episodeNumber);
        }
        localStorage.setItem(STORAGE_KEYS.SERIES_PROGRESS, JSON.stringify(all));
        return all[seriesId];
    },

    markSeasonCompleted: (seriesId, seasonNumber, completed = true, allEpisodes = []) => {
        if (typeof window === 'undefined') return;
        const all = seriesProgressStorage.getAll();
        if (!all[seriesId]) {
            all[seriesId] = { seasons: {}, completed: false, lastWatched: null };
        }
        if (!all[seriesId].seasons[seasonNumber]) {
            all[seriesId].seasons[seasonNumber] = { episodes: [], completed: false };
        }
        
        all[seriesId].seasons[seasonNumber].completed = completed;
        
        // If marking as completed, automatically mark all episodes as watched
        if (completed && allEpisodes && allEpisodes.length > 0) {
            const episodeNumbers = allEpisodes.map(ep => ep.episode_number || ep);
            all[seriesId].seasons[seasonNumber].episodes = [...new Set([
                ...(all[seriesId].seasons[seasonNumber].episodes || []),
                ...episodeNumbers
            ])].sort((a, b) => a - b);
        }
        
        all[seriesId].lastWatched = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.SERIES_PROGRESS, JSON.stringify(all));
        return all[seriesId];
    },

    markSeriesCompleted: (seriesId, completed = true, allSeasonsData = {}) => {
        if (typeof window === 'undefined') return;
        const all = seriesProgressStorage.getAll();
        if (!all[seriesId]) {
            all[seriesId] = { seasons: {}, completed: false, lastWatched: null };
        }
        all[seriesId].completed = completed;
        
        // If marking as completed, automatically mark all episodes in all seasons as watched
        if (completed && allSeasonsData && Object.keys(allSeasonsData).length > 0) {
            Object.entries(allSeasonsData).forEach(([seasonNumber, seasonData]) => {
                const seasonNum = parseInt(seasonNumber);
                if (!all[seriesId].seasons[seasonNum]) {
                    all[seriesId].seasons[seasonNum] = { episodes: [], completed: false };
                }
                
                // Mark all episodes in this season as watched
                if (seasonData.episodes && seasonData.episodes.length > 0) {
                    const episodeNumbers = seasonData.episodes.map(ep => ep.episode_number || ep);
                    all[seriesId].seasons[seasonNum].episodes = [...new Set([
                        ...(all[seriesId].seasons[seasonNum].episodes || []),
                        ...episodeNumbers
                    ])].sort((a, b) => a - b);
                }
                
                // Mark season as completed
                all[seriesId].seasons[seasonNum].completed = true;
            });
        }
        
        all[seriesId].lastWatched = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.SERIES_PROGRESS, JSON.stringify(all));
        return all[seriesId];
    },

    isEpisodeWatched: (seriesId, seasonNumber, episodeNumber) => {
        const progress = seriesProgressStorage.getSeriesProgress(seriesId);
        // If season is completed, all episodes are considered watched
        if (progress.seasons[seasonNumber]?.completed) {
            return true;
        }
        // If series is completed, all episodes are considered watched
        if (progress.completed) {
            return true;
        }
        return progress.seasons[seasonNumber]?.episodes?.includes(episodeNumber) || false;
    },

    isSeasonCompleted: (seriesId, seasonNumber) => {
        const progress = seriesProgressStorage.getSeriesProgress(seriesId);
        return progress.seasons[seasonNumber]?.completed || false;
    },

    isSeriesCompleted: (seriesId) => {
        const progress = seriesProgressStorage.getSeriesProgress(seriesId);
        return progress.completed || false;
    },
};

// User Preferences
export const preferencesStorage = {
    getAll: () => {
        if (typeof window === 'undefined') return {};
        const data = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
        return data ? JSON.parse(data) : {};
    },

    set: (key, value) => {
        if (typeof window === 'undefined') return;
        const prefs = preferencesStorage.getAll();
        prefs[key] = value;
        localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs));
        return prefs;
    },

    get: (key) => {
        const prefs = preferencesStorage.getAll();
        return prefs[key];
    },
};

// Custom Lists
export const customListsStorage = {
    getAll: () => {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_LISTS);
        return data ? JSON.parse(data) : [];
    },

    save: (lists) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.CUSTOM_LISTS, JSON.stringify(lists));
    },

    getList: (listId) => {
        const lists = customListsStorage.getAll();
        return lists.find(list => list.id === listId);
    },

    create: (name) => {
        if (typeof window === 'undefined') return null;
        const lists = customListsStorage.getAll();
        const newList = {
            id: Date.now().toString(),
            name: name.trim(),
            items: [],
            createdAt: new Date().toISOString(),
        };
        lists.push(newList);
        customListsStorage.save(lists);
        return newList;
    },

    delete: (listId) => {
        if (typeof window === 'undefined') return;
        const lists = customListsStorage.getAll();
        const filtered = lists.filter(list => list.id !== listId);
        customListsStorage.save(filtered);
        return filtered;
    },

    addItem: (listId, itemId, mediaType, itemTitle) => {
        if (typeof window === 'undefined') return;
        const lists = customListsStorage.getAll();
        const list = lists.find(l => l.id === listId);
        if (list) {
            const exists = list.items.some(item => item.id === String(itemId) && item.mediaType === mediaType);
            if (!exists) {
                list.items.push({
                    id: String(itemId),
                    mediaType,
                    title: itemTitle,
                    dateAdded: new Date().toISOString(),
                });
                customListsStorage.save(lists);
            }
        }
        return list;
    },

    removeItem: (listId, itemId, mediaType) => {
        if (typeof window === 'undefined') return;
        const lists = customListsStorage.getAll();
        const list = lists.find(l => l.id === listId);
        if (list) {
            list.items = list.items.filter(
                item => !(item.id === String(itemId) && item.mediaType === mediaType)
            );
            customListsStorage.save(lists);
        }
        return list;
    },
};

// Clear all data (for testing)
export const clearAllData = () => {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
};

