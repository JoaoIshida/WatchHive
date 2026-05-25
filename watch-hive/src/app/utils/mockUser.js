import { getMockFriendListSummaries } from './mockPublicLists';
import { enrichProfileForDisplay } from './socialProfileHelpers';

/** Mock friend user ID for localhost-only dev preview. Same ID used in ProfileFriendsSection and profile [userId] page. */
export const MOCK_FRIEND_USER_ID = '00000000-0000-0000-0000-000000000001';

/** Hostname only (no port). Shared by client and API route guards. */
export function isLocalhostHost(host) {
    if (!host || typeof host !== 'string') return false;
    const hostname = host.split(':')[0].trim().toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** Client-only: true when the app is opened on localhost. */
export function isLocalhost() {
    if (typeof window === 'undefined') return false;
    return isLocalhostHost(window.location.hostname);
}

/** Server-only: true when the incoming request targets localhost. */
export function isLocalhostRequest(req) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const firstHost = host.split(',')[0].trim();
    return isLocalhostHost(firstHost);
}

/** Mock profile data for MOCK_FRIEND_USER_ID on localhost (for "View profile" preview). */
export function getMockFriendProfile() {
    const { public_lists, shared_with_you } = getMockFriendListSummaries();
    return enrichProfileForDisplay({
        id: MOCK_FRIEND_USER_ID,
        display_name: 'Mock Friend',
        avatar_url: null,
        watched_summary: { total: 12, movies: 8, series: 4 },
        public_lists,
        shared_with_you,
        viewer_is_friend: true,
        viewer_is_self: false,
    });
}
