"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import LoadingSpinner from '../components/LoadingSpinner';

const SEARCH_DEBOUNCE_MS = 300;

export default function ProfileFriendsSection({ userId, fetchFriendsRef }) {
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
        setFriends(data.friends || []);
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
        const q = searchQuery.trim();
        if (q.length < 2) {
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
        } finally {
            setActionLoading(null);
        }
    };

    const handleAccept = (requestId) => doAction('/api/friends/accept', { requestId }, requestId);
    const handleDecline = (requestId) => doAction('/api/friends/decline', { requestId }, requestId);
    const handleCancel = (requestId) => doAction('/api/friends/cancel', { requestId }, requestId);

    const sendRequest = async (targetUserId) => {
        setActionLoading(`send-${targetUserId}`);
        try {
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: targetUserId }),
            });
            const data = await res.json();
            if (!res.ok) alert(data.error || 'Failed to send request');
            else await fetchFriends();
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
            <div className="flex justify-center py-12">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* People search */}
            <div className="futuristic-card p-4">
                <label className="block text-white font-semibold mb-2">Search people</label>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username (min 2 characters)"
                    className="w-full px-4 py-2 bg-charcoal-900/50 border border-charcoal-700/50 rounded text-white placeholder-white/40 focus:outline-none focus:border-amber-500"
                />
                {searchLoading && (
                    <p className="text-white/60 text-sm mt-2">Searching…</p>
                )}
                {searchQuery.trim().length >= 2 && !searchLoading && (
                    <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                        {searchResults.length === 0 ? (
                            <li className="text-white/60 text-sm">No users found.</li>
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
                                                    onClick={() => sendRequest(u.id)}
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
                                <Link
                                    href={`/profile/${f.userId}`}
                                    className="text-amber-500 hover:text-amber-400 text-sm ml-auto"
                                >
                                    View profile
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
