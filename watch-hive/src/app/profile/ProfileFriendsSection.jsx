"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/ConfirmationModal';
import { SkeletonListRow } from '../components/Skeleton';
import { MOCK_FRIEND_USER_ID, isLocalhost, getMockFriendProfile } from '../utils/mockUser';

const SEARCH_DEBOUNCE_MS = 300;

export default function ProfileFriendsSection({ userId, fetchFriendsRef, onFriendsChanged }) {
    const [friends, setFriends] = useState([]);
    const [pendingReceived, setPendingReceived] = useState([]);
    const [pendingSent, setPendingSent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimeoutRef = useRef(null);

    const fetchFriends = useCallback(async () => {
        const res = await fetch('/api/friends');
        if (!res.ok) return;
        const data = await res.json();
        let friendList = data.friends || [];
        if (isLocalhost()) {
            const mock = getMockFriendProfile();
            friendList = [
                { requestId: 'mock-1', userId: mock.id, display_name: mock.display_name, avatar_url: mock.avatar_url },
                ...friendList,
            ];
        }
        setFriends(friendList);
        setPendingReceived(data.pendingReceived || []);
        setPendingSent(data.pendingSent || []);
    }, []);

    useEffect(() => {
        if (fetchFriendsRef) fetchFriendsRef.current = fetchFriends;
    }, [fetchFriends, fetchFriendsRef]);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        fetchFriends().finally(() => setLoading(false));
    }, [userId, fetchFriends]);

    useEffect(() => {
        if (!userId) return undefined;
        const onRefresh = () => {
            fetchFriends();
            onFriendsChanged?.();
        };
        window.addEventListener("refreshPendingInvites", onRefresh);
        return () => window.removeEventListener("refreshPendingInvites", onRefresh);
    }, [userId, fetchFriends, onFriendsChanged]);

    useEffect(() => {
        const q = searchQuery.trim();
        if (q.length < 3) {
            setSearchResults([]);
            return;
        }
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                setSearchResults(Array.isArray(data.users) ? data.users : []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery]);

    const doAction = async (url, body, requestId) => {
        setActionLoading(requestId);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Action failed');
                return;
            }
            await fetchFriends();
            onFriendsChanged?.();
        } finally {
            setActionLoading(null);
        }
    };

    const handleAccept = (requestId) => doAction('/api/friends/accept', { requestId }, requestId);
    const handleDecline = (requestId) => doAction('/api/friends/decline', { requestId }, requestId);
    const handleCancel = (requestId) => doAction('/api/friends/cancel', { requestId }, requestId);

    const [removeFriendTarget, setRemoveFriendTarget] = useState(null);

    const handleRemoveClick = (f) => {
        setRemoveFriendTarget({ userId: f.userId, display_name: f.display_name || 'this friend' });
    };

    const handleRemoveConfirm = async () => {
        if (!removeFriendTarget) return;
        const friendUserId = removeFriendTarget.userId;
        setRemoveFriendTarget(null);
        setActionLoading(`remove-${friendUserId}`);
        try {
            if (friendUserId === MOCK_FRIEND_USER_ID) {
                setFriends((prev) => prev.filter((x) => x.userId !== friendUserId));
                onFriendsChanged?.();
                return;
            }
            const res = await fetch('/api/friends/remove', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: friendUserId }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Failed to remove friend');
                return;
            }
            await fetchFriends();
            onFriendsChanged?.();
        } finally {
            setActionLoading(null);
        }
    };

    const sendRequest = async (targetUserId, targetDisplayName) => {
        setActionLoading(`send-${targetUserId}`);
        try {
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: targetDisplayName || undefined,
                    userId: targetUserId,
                }),
            });
            const data = await res.json();
            if (!res.ok) alert(data.error || 'Failed to send request');
            else {
                await fetchFriends();
                onFriendsChanged?.();
            }
        } finally {
            setActionLoading(null);
        }
    };

    const friendIds = new Set([
        ...friends.map((f) => f.userId),
        ...pendingReceived.map((p) => p.senderId),
        ...pendingSent.map((p) => p.receiverId),
    ]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="futuristic-card p-4">
                    <div className="h-4 w-32 animate-pulse bg-charcoal-800/60 rounded mb-2" />
                    <div className="h-10 w-full animate-pulse bg-charcoal-800/60 rounded" />
                </div>
                <div className="space-y-2">
                    <div className="h-6 w-40 animate-pulse bg-charcoal-800/60 rounded mb-3" />
                    {[1, 2, 3, 4].map((i) => (
                        <SkeletonListRow key={i} className="futuristic-card" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            <ConfirmationModal
                isOpen={!!removeFriendTarget}
                onClose={() => setRemoveFriendTarget(null)}
                onConfirm={handleRemoveConfirm}
                title="Remove friend"
                message={removeFriendTarget ? `Remove ${removeFriendTarget.display_name} as a friend?` : ''}
                confirmText="Remove"
                cancelText="Cancel"
                isDanger
            />
            <div className="space-y-6">
            {/* People search */}
            <div className="futuristic-card p-4">
                <label className="block text-white font-semibold mb-2">Search</label>
                <p className="text-white/45 text-xs mb-2">Prefix of username · 3+ chars · case-sensitive</p>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Username…"
                    className="w-full px-4 py-2 bg-charcoal-900/50 border border-charcoal-700/50 rounded text-white placeholder-white/40 focus:outline-none focus:border-amber-500"
                />
                {searchLoading && (
                    <p className="text-white/45 text-xs mt-2">…</p>
                )}
                {searchQuery.trim().length >= 3 && !searchLoading && (
                    <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                        {searchResults.length === 0 ? (
                            <li className="text-white/50 text-sm">No match. Try checking for typos or using full username</li>
                        ) : (
                            searchResults.map((u) => {
                                const isSelf = u.id === userId;
                                const isFriend = friendIds.has(u.id);
                                const pendingSentTo = pendingSent.find((p) => p.receiverId === u.id);
                                const pendingFrom = pendingReceived.find((p) => p.senderId === u.id);
                                return (
                                    <li
                                        key={u.id}
                                        className="flex items-center justify-between gap-3 py-2 border-b border-charcoal-700/50 last:border-0"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <span className="text-white font-medium truncate block">
                                                {u.display_name || 'Unknown'}
                                            </span>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center gap-2">
                                            {isSelf ? (
                                                <span className="text-white/40 text-sm">You</span>
                                            ) : isFriend ? (
                                                <Link
                                                    href={`/profile/${u.id}`}
                                                    className="text-amber-500 hover:text-amber-400 text-sm"
                                                >
                                                    View profile
                                                </Link>
                                            ) : pendingSentTo ? (
                                                <span className="text-amber-500/80 text-sm">Request sent</span>
                                            ) : pendingFrom ? (
                                                <>
                                                    <button
                                                        onClick={() => handleAccept(pendingFrom.requestId)}
                                                        disabled={actionLoading === pendingFrom.requestId}
                                                        className="px-2 py-1 bg-amber-500/20 text-amber-500 rounded text-sm"
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        onClick={() => handleDecline(pendingFrom.requestId)}
                                                        disabled={actionLoading === pendingFrom.requestId}
                                                        className="px-2 py-1 bg-charcoal-700 text-white rounded text-sm"
                                                    >
                                                        Decline
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => sendRequest(u.id, u.display_name)}
                                                    disabled={actionLoading === `send-${u.id}`}
                                                    className="px-3 py-1.5 bg-amber-500/20 text-amber-500 rounded hover:bg-amber-500/30 text-sm disabled:opacity-50"
                                                >
                                                    {actionLoading === `send-${u.id}` ? '…' : 'Add friend'}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                )}
            </div>

            {/* Pending received */}
            {pendingReceived.length > 0 && (
                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">Requests received</h2>
                    <ul className="space-y-2">
                        {pendingReceived.map((p) => (
                            <li
                                key={p.requestId}
                                className="futuristic-card p-3 flex items-center justify-between gap-3"
                            >
                                <span className="text-white font-medium truncate">
                                    {p.display_name || 'Unknown'}
                                </span>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleAccept(p.requestId)}
                                        disabled={actionLoading === p.requestId}
                                        className="px-3 py-1.5 bg-amber-500/20 text-amber-500 rounded hover:bg-amber-500/30 text-sm disabled:opacity-50"
                                    >
                                        {actionLoading === p.requestId ? '…' : 'Accept'}
                                    </button>
                                    <button
                                        onClick={() => handleDecline(p.requestId)}
                                        disabled={actionLoading === p.requestId}
                                        className="px-3 py-1.5 bg-charcoal-700 text-white rounded hover:bg-charcoal-600 text-sm disabled:opacity-50"
                                    >
                                        Decline
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Pending sent */}
            {pendingSent.length > 0 && (
                <section>
                    <h2 className="text-xl font-semibold text-white mb-3">Requests sent</h2>
                    <ul className="space-y-2">
                        {pendingSent.map((p) => (
                            <li
                                key={p.requestId}
                                className="futuristic-card p-3 flex items-center justify-between gap-3"
                            >
                                <span className="text-white font-medium truncate">
                                    {p.display_name || 'Unknown'}
                                </span>
                                <button
                                    onClick={() => handleCancel(p.requestId)}
                                    disabled={actionLoading === p.requestId}
                                    className="px-3 py-1.5 bg-charcoal-700 text-white rounded hover:bg-charcoal-600 text-sm disabled:opacity-50"
                                >
                                    {actionLoading === p.requestId ? '…' : 'Cancel'}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Friends list */}
            <section>
                <h2 className="text-xl font-semibold text-white mb-3">Friends</h2>
                {friends.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0 ? (
                    <p className="text-white/60">
                        No friends yet. Send a request from a user&apos;s profile or search above.
                    </p>
                ) : friends.length === 0 ? (
                    <p className="text-white/60">No friends yet. Accept a request or send one.</p>
                ) : (
                    <ul className="space-y-2">
                        {friends.map((f) => (
                            <li key={f.requestId} className="futuristic-card p-3 flex items-center gap-3">
                                <span className="text-white font-medium truncate">
                                    {f.display_name || 'Unknown'}
                                </span>
                                <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                                    <Link
                                        href={`/profile/${f.userId}`}
                                        className="text-amber-500 hover:text-amber-400 text-sm"
                                    >
                                        View profile
                                    </Link>
                                    <button
                                        onClick={() => handleRemoveClick(f)}
                                        disabled={actionLoading === `remove-${f.userId}`}
                                        className="px-2 py-1 bg-charcoal-700 text-white/80 hover:text-white hover:bg-red-500/20 text-red-400 rounded text-sm disabled:opacity-50"
                                        title="Remove friend"
                                    >
                                        {actionLoading === `remove-${f.userId}` ? '…' : 'Remove'}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            </div>
        </>
    );
}
