/** Mock friend user ID for localhost-only dev preview. Same ID used in ProfileFriendsSection and profile [userId] page. */
export const MOCK_FRIEND_USER_ID = '00000000-0000-0000-0000-000000000001';

export function isLocalhost() {
    if (typeof window === 'undefined') return false;
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/** Mock profile data for MOCK_FRIEND_USER_ID on localhost (for "View profile" preview). */
export function getMockFriendProfile() {
    return {
        id: MOCK_FRIEND_USER_ID,
        display_name: 'Mock Friend',
        avatar_url: null,
        watched_summary: { total: 12, movies: 8, series: 4 },
        public_lists: [
            { id: 'mock-list-1', name: 'Favourites', items_count: 5 },
            { id: 'mock-list-2', name: 'To watch', items_count: 3 },
        ],
        shared_with_you: [{ id: 'mock-shared-1', name: 'Shared list', items_count: 2 }],
    };
}
