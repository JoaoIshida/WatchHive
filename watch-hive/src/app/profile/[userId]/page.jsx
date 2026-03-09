"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Film, Tv, List, Share2, ArrowLeft, Eye } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import Link from 'next/link';
import { MOCK_FRIEND_USER_ID, isLocalhost, getMockFriendProfile } from '../../utils/mockUser';

function StatCard({ icon: Icon, value, label }) {
    return (
        <div className="futuristic-card p-4 text-center flex-1 min-w-[120px]">
            <div className="flex justify-center mb-2">
                <Icon className="w-7 h-7 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-500">{value}</div>
            <div className="text-xs text-white/70 mt-1">{label}</div>
        </div>
    );
}

function ListCard({ list, icon: Icon, badge }) {
    return (
        <Link
            href={`/lists/${list.id}`}
            className="futuristic-card p-4 hover:border-amber-500/40 transition-all group block"
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <h3 className="text-white font-semibold truncate group-hover:text-amber-500 transition-colors">
                        {list.name}
                    </h3>
                </div>
                {badge && (
                    <span className="text-[10px] font-bold text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-white/50 text-sm">
                {list.items_count} {list.items_count === 1 ? 'item' : 'items'}
            </p>
        </Link>
    );
}

export default function PublicProfilePage() {
    const params = useParams();
    const userId = params?.userId;
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        if (userId === MOCK_FRIEND_USER_ID && isLocalhost()) {
            setProfile(getMockFriendProfile());
            setLoading(false);
            return;
        }
        fetch(`/api/users/${userId}/profile`, { credentials: 'include' })
            .then((res) => {
                if (!res.ok) {
                    if (res.status === 404 || res.status === 403) {
                        return res.json().then((d) => { setError(d.error || 'Profile not found'); setProfile(null); });
                    }
                    throw new Error('Failed to load profile');
                }
                return res.json();
            })
            .then((data) => { if (data && data.id) setProfile(data); })
            .catch(() => setError('Failed to load profile'))
            .finally(() => setLoading(false));
    }, [userId]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-16 flex justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="container mx-auto px-4 py-16 text-center">
                <div className="futuristic-card p-10 max-w-md mx-auto">
                    <div className="w-20 h-20 rounded-full bg-charcoal-800 flex items-center justify-center mx-auto mb-4">
                        <Eye className="w-8 h-8 text-white/30" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">{error || 'Profile not found'}</h1>
                    <p className="text-white/50 mb-6">This profile may be private or the user may have restricted who can see it.</p>
                    <Link href="/profile/friends" className="text-amber-500 hover:text-amber-400 font-semibold inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Friends
                    </Link>
                </div>
            </div>
        );
    }

    const watched = profile.watched_summary || { total: 0, movies: 0, series: 0 };
    const publicLists = profile.public_lists || [];
    const sharedWithYou = profile.shared_with_you || [];
    const initial = (profile.display_name || '?').charAt(0).toUpperCase();

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            {/* Back nav */}
            <Link href="/profile/friends" className="text-white/50 hover:text-amber-500 transition-colors inline-flex items-center gap-2 mb-6 text-sm">
                <ArrowLeft className="w-4 h-4" />
                Back to Friends
            </Link>

            {/* Hero header */}
            <div className="futuristic-card p-8 mb-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-br from-amber-400 to-amber-600">
                            {profile.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.display_name || 'User'}
                                    className="w-full h-full rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full rounded-full bg-charcoal-900 flex items-center justify-center">
                                    <span className="text-3xl font-bold text-amber-500">{initial}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-center sm:text-left">
                        <h1 className="text-2xl font-bold text-white">{profile.display_name || 'Unknown'}</h1>
                        <p className="text-white/40 text-sm mt-1">WatchHive member</p>
                    </div>
                </div>
            </div>

            {/* Stats row */}
            {watched.total > 0 && (
                <div className="flex flex-wrap gap-3 mb-6">
                    <StatCard icon={Film} value={watched.movies} label="Movies watched" />
                    <StatCard icon={Tv} value={watched.series} label="Series watched" />
                    <StatCard icon={List} value={publicLists.length} label="Public lists" />
                </div>
            )}

            {/* Public lists */}
            {publicLists.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <List className="w-5 h-5 text-amber-500" />
                        Public Lists
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {publicLists.map((list) => (
                            <ListCard key={list.id} list={list} icon={List} />
                        ))}
                    </div>
                </div>
            )}

            {/* Shared with you */}
            {sharedWithYou.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-amber-500" />
                        Shared with You
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sharedWithYou.map((list) => (
                            <ListCard key={list.id} list={list} icon={Share2} badge="Shared" />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {watched.total === 0 && publicLists.length === 0 && sharedWithYou.length === 0 && (
                <div className="futuristic-card p-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-charcoal-800 flex items-center justify-center mx-auto mb-4">
                        <Film className="w-7 h-7 text-white/30" />
                    </div>
                    <p className="text-white/50 text-lg mb-1">Nothing to show yet</p>
                    <p className="text-white/30 text-sm">This user hasn&apos;t added any watched items or public lists.</p>
                </div>
            )}
        </div>
    );
}
