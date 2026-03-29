"use client";
import { useState, useEffect } from 'react';
import { BarChart3, Eye, Bookmark, Heart, Tv, List, Users, Settings, RefreshCw, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProfilePageSkeleton } from '../components/Skeleton';

const TABS = [
    { href: '/profile', label: 'Statistics', icon: BarChart3, exact: true },
    { href: '/profile/watched', label: 'Watched', icon: Eye },
    { href: '/profile/wishlist', label: 'Wishlist', icon: Bookmark },
    { href: '/profile/favorites', label: 'Favorites', icon: Heart },
    { href: '/profile/series', label: 'Series Progress', icon: Tv },
    { href: '/profile/lists', label: 'Lists', icon: List },
    { href: '/profile/friends', label: 'Friends', icon: Users, hasBadge: true },
    { href: '/profile/notifications', label: 'Notifications', icon: Bell },
    { href: '/profile/settings', label: 'Settings', icon: Settings },
];

export default function ProfileLayout({ children }) {
    const { user, loading: authLoading } = useAuth();
    const { refreshUserData, loading } = useUserData();
    const pathname = usePathname();
    const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

    useEffect(() => {
        if (!user?.id) { setPendingInvitesCount(0); return; }
        fetch('/api/friends/pending-count', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : { count: 0 }))
            .then((data) => setPendingInvitesCount(data?.count ?? 0))
            .catch(() => setPendingInvitesCount(0));
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) {
            setUnreadNotificationsCount(0);
            return;
        }
        fetch('/api/notifications?unreadCount=1', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : { unread: 0 }))
            .then((data) => setUnreadNotificationsCount(data?.unread ?? 0))
            .catch(() => setUnreadNotificationsCount(0));
    }, [user?.id]);

    useEffect(() => {
        const handler = (e) => {
            if (typeof e.detail?.count === 'number') setPendingInvitesCount(e.detail.count);
        };
        window.addEventListener('refreshPendingInvites', handler);
        return () => window.removeEventListener('refreshPendingInvites', handler);
    }, []);

    useEffect(() => {
        const refreshUnread = () => {
            if (!user?.id) return;
            fetch('/api/notifications?unreadCount=1', { credentials: 'include' })
                .then((res) => (res.ok ? res.json() : { unread: 0 }))
                .then((data) => setUnreadNotificationsCount(data?.unread ?? 0))
                .catch(() => setUnreadNotificationsCount(0));
        };
        window.addEventListener('refreshNotifications', refreshUnread);
        return () => window.removeEventListener('refreshNotifications', refreshUnread);
    }, [user?.id]);

    if (pathname.match(/^\/profile\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)) {
        return children;
    }

    if (authLoading || loading) {
        return <div className="page-container max-w-7xl"><ProfilePageSkeleton /></div>;
    }

    if (!user) {
        return (
            <div className="page-container max-w-7xl">
                <h1 className="page-title">Dashboard</h1>
                <div className="futuristic-card p-8 text-center">
                    <p className="text-xl text-white mb-4">Please sign in to view your dashboard</p>
                    <p className="text-amber-500/80 mb-6">Sign in to track your watched content, wishlist, and more!</p>
                    <div className="flex items-center justify-center gap-4">
                        <button onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }))} className="futuristic-button-yellow px-6 py-3">Sign In</button>
                        <button onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signup' } }))} className="futuristic-button px-6 py-3">Sign Up</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container max-w-7xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="page-title mb-0">Dashboard</h1>
                <button
                    onClick={refreshUserData}
                    className="futuristic-button flex items-center gap-2"
                    title="Refresh data"
                    aria-label="Refresh data"
                >
                    <RefreshCw className="w-5 h-5" />
                    <span className="hidden sm:inline">Refresh</span>
                </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 border-b border-charcoal-700/30">
                {TABS.map((tab) => {
                    const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
                    const TabIcon = tab.icon;
                    const tabTitle =
                        tab.href === '/profile/notifications'
                            ? unreadNotificationsCount > 0
                                ? `Notifications (${unreadNotificationsCount} unread)`
                                : 'Notifications'
                            : tab.label;
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            title={tabTitle}
                            className={`px-4 py-2 font-semibold transition-colors flex items-center gap-2 relative ${isActive ? 'text-amber-500 border-b-2 border-amber-500' : 'text-white hover:text-amber-500'}`}
                        >
                            <TabIcon className="w-4 h-4 shrink-0" aria-hidden />
                            {tab.label}
                            {tab.href === '/profile/notifications' && unreadNotificationsCount > 0 && (
                                <span
                                    className="ml-0.5 w-2 h-2 bg-red-500 rounded-full shrink-0"
                                    title={`${unreadNotificationsCount} unread`}
                                    aria-hidden
                                />
                            )}
                            {tab.hasBadge && pendingInvitesCount > 0 && (
                                <span className="bg-red-500 text-white text-xs font-bold min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center">
                                    {pendingInvitesCount > 99 ? '99+' : pendingInvitesCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>

            {children}
        </div>
    );
}
