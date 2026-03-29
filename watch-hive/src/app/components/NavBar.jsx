"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Tv, LayoutList, Compass, ChevronDown, ChevronRight, User, Users, Settings, LogOut, Search, X, Menu, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseProfileRealtime } from '../hooks/useSupabaseProfileRealtime';
import QuickSearch from './QuickSearch';

const FilterDropdownMenu = ({ label, basePath, items, labelIcon: LabelIcon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const timeoutRef = useRef(null);

    const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handleScroll = () => setIsOpen(false);
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [isOpen]);

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        // Add a small delay before closing to allow moving mouse to dropdown
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 150);
    };

    return (
        <div
            ref={dropdownRef}
            className="relative inline-block text-left"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <a
                href={basePath}
                className="inline-flex items-center px-4 py-2 text-sm font-bold text-white hover:text-amber-500 transition-colors border-b-2 border-transparent hover:border-amber-500 pb-1"
            >
                {LabelIcon && <LabelIcon className="w-4 h-4 mr-1.5" />}
                {label}
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </a>

            {isOpen && (
                <div 
                    className="absolute left-0 z-10 mt-1 w-56 py-2 bg-charcoal-900/95 backdrop-blur-sm border border-charcoal-700 rounded-lg shadow-subtle-lg"
                >
                    {items.map((item, index) => {
                        const ItemIcon = item.icon;
                        return (
                            <a 
                                key={index} 
                                href={item.href} 
                                className="flex items-center gap-2 px-4 py-2 text-white hover:bg-charcoal-800 hover:text-amber-500 transition-colors text-sm"
                            >
                                {ItemIcon && <ItemIcon className="w-4 h-4 flex-shrink-0" />}
                                {item.label}
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ProfileDropdown = ({ onSignOut, user, pendingInvitesCount = 0, unreadNotificationsCount = 0 }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handleScroll = () => setIsOpen(false);
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [isOpen]);

    const displayName = user?.display_name || user?.email || 'User';

    return (
        <div
            ref={dropdownRef}
            className="relative inline-block text-left"
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-white font-semibold hover:text-amber-500 transition-colors p-2"
                title="Dashboard"
            >
                <User className="w-5 h-5" />
                <span className="hidden md:inline">{displayName}</span>
                <span className="relative inline-flex">
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    {pendingInvitesCount > 0 && (
                        <span className="absolute -top-1.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-charcoal-950" aria-label={`${pendingInvitesCount} pending invitation${pendingInvitesCount !== 1 ? 's' : ''}`} />
                    )}
                </span>
            </button>

            {isOpen && (
                <div 
                    className="absolute right-0 z-10 mt-1 w-56 py-2 bg-charcoal-900/95 backdrop-blur-sm border border-charcoal-700 rounded-lg shadow-subtle-lg md:right-0"
                >
                    <a 
                        href="/profile"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-white hover:bg-charcoal-700 hover:text-amber-500 transition-colors text-sm"
                    >
                        <User className="w-4 h-4" />
                        Dashboard
                    </a>
                    <a 
                        href="/profile/friends"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-white hover:bg-charcoal-700 hover:text-amber-500 transition-colors text-sm"
                    >
                        <Users className="w-4 h-4" />
                        <span>Friends</span>
                        {pendingInvitesCount > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-xs font-bold min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center">
                                {pendingInvitesCount > 99 ? '99+' : pendingInvitesCount}
                            </span>
                        )}
                    </a>
                    <a 
                        href="/profile/notifications"
                        onClick={() => setIsOpen(false)}
                        className="relative flex items-center gap-2 px-4 py-2 text-white hover:bg-charcoal-700 hover:text-amber-500 transition-colors text-sm"
                    >
                        <span className="relative inline-flex">
                            <Bell className="w-4 h-4" />
                            {unreadNotificationsCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-charcoal-900" aria-hidden />
                            )}
                        </span>
                        Notifications
                    </a>
                    <a 
                        href="/profile/settings"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-white hover:bg-charcoal-700 hover:text-amber-500 transition-colors text-sm"
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                    </a>
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            onSignOut();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-white hover:bg-charcoal-700 hover:text-amber-500 transition-colors text-sm text-left"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    );
};

const Navbar = () => {
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [mobileMoviesExpanded, setMobileMoviesExpanded] = useState(false);
    const [mobileSeriesExpanded, setMobileSeriesExpanded] = useState(false);
    const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    const { user, loading, signOut } = useAuth();

    useSupabaseProfileRealtime(user?.id);

    useEffect(() => {
        if (!isMobileMenuOpen) {
            setMobileMoviesExpanded(false);
            setMobileSeriesExpanded(false);
        }
    }, [isMobileMenuOpen]);

    const fetchPendingCount = useCallback(() => {
        if (!user?.id) {
            setPendingInvitesCount(0);
            return;
        }
        fetch('/api/friends/pending-count', { credentials: 'include' })
            .then((res) => res.ok ? res.json() : { count: 0 })
            .then((data) => setPendingInvitesCount(data?.count ?? 0))
            .catch(() => setPendingInvitesCount(0));
    }, [user?.id]);

    const fetchUnreadNotifications = useCallback(() => {
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
        fetchPendingCount();
    }, [fetchPendingCount]);

    useEffect(() => {
        fetchUnreadNotifications();
    }, [fetchUnreadNotifications]);

    useEffect(() => {
        const onRefreshNotifications = () => fetchUnreadNotifications();
        window.addEventListener('refreshNotifications', onRefreshNotifications);
        return () => window.removeEventListener('refreshNotifications', onRefreshNotifications);
    }, [fetchUnreadNotifications]);

    useEffect(() => {
        const handleRefreshPendingInvites = (e) => {
            const count = e.detail?.count;
            if (typeof count === 'number') setPendingInvitesCount(count);
            else fetchPendingCount();
        };
        window.addEventListener('refreshPendingInvites', handleRefreshPendingInvites);
        return () => window.removeEventListener('refreshPendingInvites', handleRefreshPendingInvites);
    }, [fetchPendingCount]);

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
        router.refresh();
    };

    const movieQuickFilters = [
        { href: '/movies', label: 'All Movies' },
        { href: '/movies?trending=true', label: 'Trending' },
        { href: '/movies?upcoming=true', label: 'Upcoming' },
        { href: '/movies?dateRange=thisYear', label: 'This Year' },
    ];

    const seriesQuickFilters = [
        { href: '/series', label: 'All Series' },
        { href: '/series?trending=true', label: 'Trending' },
        { href: '/series?airingToday=true', label: 'Airing Today' },
        { href: '/series?upcoming=true', label: 'Upcoming' },
        { href: '/series?dateRange=thisYear', label: 'This Year' },
    ];

    const discoverMenuItems = [
        { href: '/tools', label: 'Overview' },
        { href: '/recommendations', label: 'Get Recommendations' },
    ];

    return (
        <nav className="bg-charcoal-950/95 backdrop-blur-md border-b border-charcoal-700 shadow-subtle p-4 sticky top-0 z-[120] max-h-screen overflow-visible">
            <div className="container mx-auto flex items-center justify-between gap-4">
                {/* Logo */}
                <a className="text-amber-500 text-3xl font-bold cursor-pointer hover:text-amber-400 transition-colors flex-shrink-0" href="/">
                    <img src="/watchhive-logo.png" alt="Watch Hive Logo" className="inline h-12 w-auto mr-2 align-middle scale-125" />
                </a>
                
                {/* Desktop Navigation */}
                <div className='hidden md:flex items-center gap-6 flex-1 max-w-4xl'>
                    {/* Movies Dropdown */}
                    <FilterDropdownMenu 
                        label="Movies"
                        basePath="/movies"
                        items={movieQuickFilters}
                        labelIcon={Film}
                    />
                    
                    {/* Series Dropdown */}
                    <FilterDropdownMenu 
                        label="Series"
                        basePath="/series"
                        items={seriesQuickFilters}
                        labelIcon={Tv}
                    />
                    
                    {/* Collections & Lists */}
                    <a
                        href="/browse"
                        className="inline-flex items-center px-4 py-2 text-sm font-bold text-white hover:text-amber-500 transition-colors border-b-2 border-transparent hover:border-amber-500 pb-1 whitespace-nowrap"
                    >
                        <LayoutList className="w-4 h-4 mr-1.5" />
                        Collections
                    </a>

                    {/* Discover Dropdown */}
                    <FilterDropdownMenu
                        label="Discover"
                        basePath="/tools"
                        items={discoverMenuItems}
                        labelIcon={Compass}
                    />

                    {/* Inline Search Bar */}
                    <div className="flex-1 max-w-md">
                        <QuickSearch isNavbar={true} />
                    </div>
                </div>
                
                {/* Desktop Auth Links */}
                <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                    {loading ? null : (user && user.id) ? (
                        <ProfileDropdown
                            onSignOut={handleSignOut}
                            user={user}
                            pendingInvitesCount={pendingInvitesCount}
                            unreadNotificationsCount={unreadNotificationsCount}
                        />
                    ) : (
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
                            }}
                            className="futuristic-button-yellow text-sm px-4 py-2"
                        >
                            Sign In
                        </button>
                    )}
                </div>

                {/* Mobile Right Side: Search Icon + Menu Button */}
                <div className="md:hidden flex items-center gap-2">
                    <button
                        onClick={() => {
                            setIsMobileSearchOpen(!isMobileSearchOpen);
                            setIsMobileMenuOpen(false);
                        }}
                        className="text-white hover:text-amber-500 transition-colors p-2"
                        aria-label="Toggle search"
                    >
                        {isMobileSearchOpen ? <X className="w-6 h-6" /> : <Search className="w-6 h-6" />}
                    </button>
                    <button
                        onClick={() => {
                            setIsMobileMenuOpen(!isMobileMenuOpen);
                            setIsMobileSearchOpen(false);
                        }}
                        className="relative inline-flex text-white hover:text-amber-500 transition-colors p-2"
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        {!isMobileMenuOpen && pendingInvitesCount > 0 && (
                            <span className="absolute -top-1.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-charcoal-950" aria-label={`${pendingInvitesCount} pending invitation${pendingInvitesCount !== 1 ? 's' : ''}`} />
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile Search */}
            {isMobileSearchOpen && (
                <div className="md:hidden mt-4 border-t border-charcoal-700 pt-4 px-2">
                    <QuickSearch 
                        key="mobile-search"
                        isNavbar={true} 
                        onClose={() => setIsMobileSearchOpen(false)}
                        autoFocus={true}
                    />
                </div>
            )}

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden mt-4 border-t border-charcoal-700 pt-4">
                    <div 
                        className="flex flex-col gap-4 pb-4 min-h-0" 
                        style={{ 
                            maxHeight: 'calc(100vh - 220px)',
                            overflowY: 'scroll',
                            WebkitOverflowScrolling: 'touch',
                            overscrollBehavior: 'contain',
                            touchAction: 'pan-y',
                            WebkitTransform: 'translateZ(0)',
                            transform: 'translateZ(0)'
                        }}
                    >
                        {/* Movies Section — filters collapsed until expanded */}
                        <div className="flex flex-col gap-0">
                            <div className="flex items-center gap-1 pl-2 pr-2">
                                <button
                                    type="button"
                                    className="p-2 text-amber-500 hover:bg-charcoal-800/80 rounded-md transition-colors"
                                    aria-expanded={mobileMoviesExpanded}
                                    aria-label={mobileMoviesExpanded ? 'Hide movie filters' : 'Show movie filters'}
                                    onClick={() => setMobileMoviesExpanded((v) => !v)}
                                >
                                    <ChevronRight className={`w-5 h-5 transition-transform ${mobileMoviesExpanded ? 'rotate-90' : ''}`} />
                                </button>
                                <a
                                    href="/movies"
                                    className="text-amber-500 font-semibold text-sm flex flex-1 items-center gap-2 py-2 min-w-0"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <Film className="w-4 h-4 flex-shrink-0" />
                                    Movies
                                </a>
                            </div>
                            {mobileMoviesExpanded &&
                                movieQuickFilters.map((filter, index) => (
                                    <a
                                        key={index}
                                        href={filter.href}
                                        className="text-white hover:text-amber-500 transition-colors pl-12 pr-4 py-2 border-l-2 border-transparent hover:border-amber-500"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        {filter.label}
                                    </a>
                                ))}
                        </div>

                        {/* Series Section — filters collapsed until expanded */}
                        <div className="flex flex-col gap-0">
                            <div className="flex items-center gap-1 pl-2 pr-2">
                                <button
                                    type="button"
                                    className="p-2 text-amber-500 hover:bg-charcoal-800/80 rounded-md transition-colors"
                                    aria-expanded={mobileSeriesExpanded}
                                    aria-label={mobileSeriesExpanded ? 'Hide series filters' : 'Show series filters'}
                                    onClick={() => setMobileSeriesExpanded((v) => !v)}
                                >
                                    <ChevronRight className={`w-5 h-5 transition-transform ${mobileSeriesExpanded ? 'rotate-90' : ''}`} />
                                </button>
                                <a
                                    href="/series"
                                    className="text-amber-500 font-semibold text-sm flex flex-1 items-center gap-2 py-2 min-w-0"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <Tv className="w-4 h-4 flex-shrink-0" />
                                    Series
                                </a>
                            </div>
                            {mobileSeriesExpanded &&
                                seriesQuickFilters.map((filter, index) => (
                                    <a
                                        key={index}
                                        href={filter.href}
                                        className="text-white hover:text-amber-500 transition-colors pl-12 pr-4 py-2 border-l-2 border-transparent hover:border-amber-500"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        {filter.label}
                                    </a>
                                ))}
                        </div>
                        
                        {/* Collections & Lists */}
                        <div className="flex flex-col gap-2">
                            <div className="text-amber-500 font-semibold text-sm mb-1 pl-4 flex items-center gap-2">
                                <LayoutList className="w-4 h-4" />
                                Collections & Lists
                            </div>
                            <a
                                href="/browse"
                                className="text-white hover:text-amber-500 transition-colors pl-8 py-2 border-l-2 border-transparent hover:border-amber-500"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Browse collections
                            </a>
                        </div>

                        {/* Discover Section */}
                        <div className="flex flex-col gap-2">
                            <a
                                href="/tools"
                                className="text-amber-500 font-semibold text-sm mb-1 pl-4 flex items-center gap-2"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <Compass className="w-4 h-4" />
                                Discover
                            </a>
                            {discoverMenuItems.map((item, index) => (
                                <a
                                    key={index}
                                    href={item.href}
                                    className="text-white hover:text-amber-500 transition-colors pl-8 py-2 border-l-2 border-transparent hover:border-amber-500"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {item.label}
                                </a>
                            ))}
                        </div>

                        {loading ? null : (user && user.id) ? (
                            <>
                                <a 
                                    href="/profile" 
                                    className="flex items-center gap-2 text-white font-semibold hover:text-amber-500 transition-colors py-2 border-l-2 border-transparent hover:border-amber-500 pl-4"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <User className="w-5 h-5" />
                                    <span>Dashboard</span>
                                </a>
                                <a 
                                    href="/profile/friends" 
                                    className="flex items-center gap-2 text-white font-semibold hover:text-amber-500 transition-colors py-2 border-l-2 border-transparent hover:border-amber-500 pl-4"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <Users className="w-5 h-5" />
                                    <span>Friends</span>
                                    {pendingInvitesCount > 0 && (
                                        <span className="ml-auto bg-red-500 text-white text-xs font-bold min-w-[1.25rem] h-5 px-1.5 rounded-full flex items-center justify-center">
                                            {pendingInvitesCount > 99 ? '99+' : pendingInvitesCount}
                                        </span>
                                    )}
                                </a>
                                <a 
                                    href="/profile/notifications" 
                                    className="relative flex items-center gap-2 text-white font-semibold hover:text-amber-500 transition-colors py-2 border-l-2 border-transparent hover:border-amber-500 pl-4"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="relative inline-flex">
                                        <Bell className="w-5 h-5" />
                                        {unreadNotificationsCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-charcoal-950" aria-hidden />
                                        )}
                                    </span>
                                    <span>Notifications</span>
                                </a>
                                <a 
                                    href="/profile/settings" 
                                    className="flex items-center gap-2 text-white font-semibold hover:text-amber-500 transition-colors py-2 border-l-2 border-transparent hover:border-amber-500 pl-4"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <Settings className="w-5 h-5" />
                                    <span>Settings</span>
                                </a>
                                <div className="border-t border-charcoal-600 my-2" aria-hidden />
                                <button
                                    onClick={() => {
                                        handleSignOut();
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="flex items-center gap-2 text-white/70 hover:text-white transition-colors py-2 border-l-2 border-transparent hover:border-amber-500 pl-4 text-left"
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span>Sign Out</span>
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
                                    setIsMobileMenuOpen(false);
                                }}
                                className="futuristic-button-yellow text-sm px-4 py-2 w-full text-left"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
