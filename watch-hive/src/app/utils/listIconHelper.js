import { Heart, Bookmark, List, Share2, Globe, Clock } from 'lucide-react';
import {
    MOCK_PUBLIC_LIST_FAVOURITES_ID,
    MOCK_PUBLIC_LIST_TO_WATCH_ID,
    MOCK_SHARED_LIST_ID,
} from './mockPublicLists';

/**
 * Icon + class for a list row, aligned with profile nav (Heart = favorites, Bookmark = wishlist/to watch).
 * @param {{ id?: string, name?: string }} list
 * @param {{ shared?: boolean }} options
 */
export function getListIconMeta(list, options = {}) {
    if (options.shared) {
        return { Icon: Share2, className: 'text-amber-500' };
    }

    const id = list?.id;
    if (id === MOCK_PUBLIC_LIST_FAVOURITES_ID) {
        return { Icon: Heart, className: 'text-rose-400 fill-current' };
    }
    if (id === MOCK_PUBLIC_LIST_TO_WATCH_ID) {
        return { Icon: Bookmark, className: 'text-amber-500' };
    }
    if (id === MOCK_SHARED_LIST_ID) {
        return { Icon: Share2, className: 'text-amber-500' };
    }

    const name = (list?.name || '').toLowerCase().trim();
    if (/favo(u)?rite/.test(name)) {
        return { Icon: Heart, className: 'text-rose-400 fill-current' };
    }
    if (/wishlist|to watch|watch\s*list|up next|queue/.test(name)) {
        return { Icon: Bookmark, className: 'text-amber-500' };
    }
    if (/weekend|shared|collab/.test(name)) {
        return { Icon: Share2, className: 'text-amber-500' };
    }
    if (/watching|in progress|currently/.test(name)) {
        return { Icon: Clock, className: 'text-amber-500' };
    }

    return { Icon: List, className: 'text-amber-500' };
}

/** Section header icon for grouped lists on another user's profile. */
export function getPublicListsSectionIcon() {
    return { Icon: Globe, className: 'text-amber-500' };
}

export function getSharedListsSectionIcon() {
    return { Icon: Share2, className: 'text-amber-500' };
}
