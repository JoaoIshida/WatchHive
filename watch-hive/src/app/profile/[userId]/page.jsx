"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Film,
    Tv,
    Share2,
    Globe,
    UserCheck,
    UserPlus,
    Layers,
    Eye,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import ImageWithFallback from '../../components/ImageWithFallback';
import ListGridSection from '../../components/ListGridSection';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_FRIEND_USER_ID, isLocalhost, getMockFriendProfile } from '../../utils/mockUser';
import {
    TMDB_POSTER,
    TMDB_BACKDROP,
    truncateLabel,
    enrichProfileForDisplay,
    collectHeroPosterPaths,
} from '../../utils/socialProfileHelpers';

function SocialProfileContent({ profile, onFriendRequestSent }) {
    const { user, loading: authLoading } = useAuth();
    const [tab, setTab] = useState(
        (profile.shared_with_you?.length ?? 0) > 0 ? 'shared' : 'public'
    );
    const [addFriendLoading, setAddFriendLoading] = useState(false);

    const initial = (profile.display_name || '?').charAt(0).toUpperCase();
    const publicLists = profile.public_lists || [];
    const sharedLists = profile.shared_with_you || [];
    const watched = profile.watched_summary || { movies: 0, series: 0, total: 0 };
    const heroPosters = useMemo(() => collectHeroPosterPaths(profile), [profile]);

    const activeLists = tab === 'shared' ? sharedLists : publicLists;
    const ActiveIcon = tab === 'shared' ? Share2 : Globe;
    const showFriendBadge = profile.viewer_is_friend && !profile.viewer_is_self;
    const showAddFriend = !profile.viewer_is_friend && !profile.viewer_is_self;
    const profileName = profile.display_name || 'Unknown';
    const profileNameDisplay = truncateLabel(profileName);

    const promptSignIn = () => {
        window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
    };

    const handleAddFriend = async () => {
        if (authLoading) return;
        if (!user) {
            promptSignIn();
            return;
        }

        setAddFriendLoading(true);
        try {
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: profile.id, displayName: profile.display_name }),
            });
            const data = await res.json();
            if (res.status === 401) {
                promptSignIn();
                return;
            }
            if (!res.ok) {
                alert(data.error || 'Failed to send request');
                return;
            }
            onFriendRequestSent?.();
            alert('Friend request sent.');
        } catch {
            alert('Failed to send request');
        } finally {
            setAddFriendLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen pb-16 overflow-x-hidden">
            <div className="absolute inset-x-0 top-0 h-[420px] overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-charcoal-950/80 z-[1]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-charcoal-950/50 to-charcoal-950 z-[2]" />
                {heroPosters.length > 0 && (
                    <div className="grid grid-cols-3 grid-rows-2 gap-1 p-2 opacity-40 blur-sm scale-105 z-0">
                        {heroPosters.map((path, i) => (
                            <div key={i} className="relative aspect-video overflow-hidden rounded-lg">
                                <ImageWithFallback
                                    src={TMDB_BACKDROP(path) || TMDB_POSTER(path)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                )}
                <div
                    className="absolute inset-0 z-[3] opacity-[0.07]"
                    style={{
                        backgroundImage:
                            'radial-gradient(circle at 20% 50%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 80% 20%, #d97706 0%, transparent 40%)',
                    }}
                />
            </div>

            <div className="relative z-10 container mx-auto px-4 pt-4 max-w-5xl">
                <Link
                    href="/profile/friends"
                    className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-amber-400 mb-6 backdrop-blur-sm bg-black/20 px-3 py-1.5 rounded-full border border-white/10"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Friends
                </Link>

                <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-8">
                    <div className="relative flex-shrink-0 mx-auto sm:mx-0">
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 blur-md opacity-60" />
                        <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl rotate-3 overflow-hidden border-2 border-amber-500/40 shadow-2xl">
                            {profile.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.display_name}
                                    className="w-full h-full object-cover -rotate-3 scale-110"
                                />
                            ) : (
                                <div className="w-full h-full bg-charcoal-900 flex items-center justify-center -rotate-3">
                                    <span className="text-5xl font-black text-amber-500">{initial}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left min-w-0">
                        <p className="text-amber-500/70 text-xs font-semibold uppercase tracking-[0.25em] mb-2">
                            WatchHive member
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
                            <h1
                                className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none"
                                title={profileName}
                            >
                                {profileNameDisplay}
                            </h1>
                            {showFriendBadge && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 flex-shrink-0">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    Friend
                                </span>
                            )}
                            {showAddFriend && (
                                <button
                                    type="button"
                                    onClick={handleAddFriend}
                                    disabled={addFriendLoading}
                                    className="futuristic-button-yellow inline-flex items-center gap-1.5 text-xs px-3 py-1.5 flex-shrink-0 disabled:opacity-50"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    {addFriendLoading ? 'Sending…' : 'Add friend'}
                                </button>
                            )}
                        </div>
                        <p className="text-white/45 mt-3 text-sm max-w-md mx-auto sm:mx-0">
                            {watched.total} titles tracked · {publicLists.length} public ·{' '}
                            {sharedLists.length} shared with you
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                    <div className="col-span-2 md:col-span-2 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 to-charcoal-900/90 p-5 backdrop-blur-md">
                        <Layers className="w-8 h-8 text-amber-500 mb-3 opacity-80" />
                        <p className="text-3xl font-black text-white tabular-nums">{watched.total}</p>
                        <p className="text-sm text-amber-500/90 font-medium mt-1">Total watched</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-charcoal-900/80 p-4 backdrop-blur-md flex flex-col justify-between cursor-default">
                        <Film className="w-6 h-6 text-amber-500" />
                        <div>
                            <p className="text-2xl font-bold text-white tabular-nums">{watched.movies}</p>
                            <p className="text-[10px] uppercase tracking-wider text-white/45">Movies</p>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-charcoal-900/80 p-4 backdrop-blur-md flex flex-col justify-between cursor-default">
                        <Tv className="w-6 h-6 text-amber-500" />
                        <div>
                            <p className="text-2xl font-bold text-white tabular-nums">{watched.series}</p>
                            <p className="text-[10px] uppercase tracking-wider text-white/45">Series</p>
                        </div>
                    </div>
                </div>

                {(publicLists.length > 0 || sharedLists.length > 0) && (
                    <div className="flex gap-2 p-1 rounded-2xl bg-charcoal-900/90 border border-charcoal-700/50 backdrop-blur-md mb-8 max-w-md">
                        {sharedLists.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setTab('shared')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                    tab === 'shared'
                                        ? 'bg-amber-500 text-black shadow-md'
                                        : 'text-white/50 hover:text-white'
                                }`}
                            >
                                <Share2 className="w-4 h-4" />
                                Shared
                                <span
                                    className={`text-[10px] px-1.5 rounded-full ${
                                        tab === 'shared' ? 'bg-black/20' : 'bg-amber-500/20 text-amber-500'
                                    }`}
                                >
                                    {sharedLists.length}
                                </span>
                            </button>
                        )}
                        {publicLists.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setTab('public')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                    tab === 'public'
                                        ? 'bg-amber-500 text-black shadow-md'
                                        : 'text-white/50 hover:text-white'
                                }`}
                            >
                                <Globe className="w-4 h-4" />
                                Public
                                <span
                                    className={`text-[10px] px-1.5 rounded-full ${
                                        tab === 'public' ? 'bg-black/20' : 'bg-amber-500/20 text-amber-500'
                                    }`}
                                >
                                    {publicLists.length}
                                </span>
                            </button>
                        )}
                    </div>
                )}

                {activeLists.length > 0 ? (
                    <ListGridSection
                        title={tab === 'shared' ? 'Shared with you' : 'Public lists'}
                        icon={ActiveIcon}
                        lists={activeLists}
                        shared={tab === 'shared'}
                        badge={tab === 'shared' ? 'Shared with you' : undefined}
                    />
                ) : (
                    watched.total === 0 &&
                    publicLists.length === 0 &&
                    sharedLists.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-charcoal-600/80 bg-charcoal-900/50 py-16 text-center">
                            <Film className="w-10 h-10 text-white/15 mx-auto mb-3" />
                            <p className="text-white/40 text-sm">Nothing to show on this profile yet.</p>
                        </div>
                    )
                )}

                {tab === 'shared' && publicLists.length > 0 && (
                    <div className="mt-12 opacity-90">
                        <ListGridSection title="Public lists" icon={Globe} lists={publicLists} />
                    </div>
                )}
                {tab === 'public' && sharedLists.length > 0 && (
                    <div className="mt-12 opacity-90">
                        <ListGridSection
                            title="Shared with you"
                            icon={Share2}
                            lists={sharedLists}
                            shared
                            badge="Shared with you"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PublicProfilePage() {
    const params = useParams();
    const userId = params?.userId;
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }
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
                    return res.json().then((d) => {
                        setError(d.error || 'Profile not found');
                        setProfile(null);
                    });
                }
                return res.json();
            })
            .then((data) => {
                if (data?.id) {
                    setProfile(enrichProfileForDisplay(data));
                }
            })
            .catch(() => setError('Failed to load profile'))
            .finally(() => setLoading(false));
    }, [userId]);

    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
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
                    <p className="text-white/50 mb-6">
                        This profile may be private or the user may have restricted who can see it.
                    </p>
                    <Link
                        href="/profile/friends"
                        className="text-amber-500 hover:text-amber-400 font-semibold inline-flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Friends
                    </Link>
                </div>
            </div>
        );
    }

    return <SocialProfileContent profile={profile} />;
}
