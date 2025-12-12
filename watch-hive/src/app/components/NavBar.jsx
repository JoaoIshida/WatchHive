"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import QuickSearch from './QuickSearch';

const FilterDropdownMenu = ({ label, basePath, items }) => {
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
                {label}
                <svg
                    className={`w-4 h-4 ml-1 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </a>

            {isOpen && (
                <div 
                    className="absolute left-0 z-10 mt-1 w-56 py-2 bg-charcoal-900/95 backdrop-blur-sm border border-charcoal-700 rounded-lg shadow-subtle-lg"
                >
                    {items.map((item, index) => (
                        <a 
                            key={index} 
                            href={item.href} 
                            className="block px-4 py-2 text-white hover:bg-charcoal-800 hover:text-amber-500 transition-colors text-sm"
                        >
                            {item.label}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

const ProfileDropdown = ({ onSignOut, user }) => {
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

    const displayName = user?.display_name || user?.email || 'User';

    return (
        <div
            ref={dropdownRef}
            className="relative inline-block text-left"
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-white font-semibold hover:text-amber-500 transition-colors p-2"
                title="Profile"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden md:inline">{displayName}</span>
                <svg
                    className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Profile Menu (Dashboard)
                    </a>
                    <a 
                        href="/profile?tab=settings"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-white hover:bg-charcoal-700 hover:text-amber-500 transition-colors text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                    </a>
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            onSignOut();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-white hover:bg-charcoal-700 hover:text-amber-500 transition-colors text-sm text-left"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
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
    const { user, loading, signOut } = useAuth();


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
                    />
                    
                    {/* Series Dropdown */}
                    <FilterDropdownMenu 
                        label="Series"
                        basePath="/series"
                        items={seriesQuickFilters}
                    />
                    
                    {/* Inline Search Bar */}
                    <div className="flex-1 max-w-md">
                        <QuickSearch isNavbar={true} />
                    </div>
                </div>
                
                {/* Desktop Auth Links */}
                <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                    {loading ? null : (user && user.id) ? (
                        <ProfileDropdown onSignOut={handleSignOut} user={user} />
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
                        {isMobileSearchOpen ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setIsMobileMenuOpen(!isMobileMenuOpen);
                            setIsMobileSearchOpen(false);
                        }}
                        className="text-white hover:text-amber-500 transition-colors p-2"
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
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
                        {/* Movies Section */}
                        <div className="flex flex-col gap-2">
                            <a 
                                href="/movies" 
                                className="text-amber-500 font-semibold text-sm mb-1 pl-4"
                            >
                                Movies
                            </a>
                            {movieQuickFilters.map((filter, index) => (
                                <a 
                                    key={index}
                                    href={filter.href} 
                                    className="text-white hover:text-amber-500 transition-colors pl-8 py-2 border-l-2 border-transparent hover:border-amber-500"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {filter.label}
                                </a>
                            ))}
                        </div>
                        
                        {/* Series Section */}
                        <div className="flex flex-col gap-2">
                            <a 
                                href="/series" 
                                className="text-amber-500 font-semibold text-sm mb-1 pl-4"
                            >
                                Series
                            </a>
                            {seriesQuickFilters.map((filter, index) => (
                                <a 
                                    key={index}
                                    href={filter.href} 
                                    className="text-white hover:text-amber-500 transition-colors pl-8 py-2 border-l-2 border-transparent hover:border-amber-500"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {filter.label}
                                </a>
                            ))}
                        </div>
                        
                        {loading ? null : (user && user.id) ? (
                            <>
                                <div className="flex items-center gap-2 text-white font-semibold py-2 pl-4">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span>{user?.display_name || user?.email || 'User'}</span>
                                </div>
                                <a 
                                    href="/profile" 
                                    className="flex items-center gap-2 text-white font-semibold hover:text-amber-500 transition-colors py-2 border-l-2 border-transparent hover:border-amber-500 pl-4"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <span>Profile Menu (Dashboard)</span>
                                </a>
                                <a 
                                    href="/profile?tab=settings" 
                                    className="flex items-center gap-2 text-white font-semibold hover:text-amber-500 transition-colors py-2 border-l-2 border-transparent hover:border-amber-500 pl-4"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>Settings</span>
                                </a>
                                <button
                                    onClick={() => {
                                        handleSignOut();
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="flex items-center gap-2 text-white/70 hover:text-white transition-colors py-2 border-l-2 border-transparent hover:border-amber-500 pl-4 text-left"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
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
