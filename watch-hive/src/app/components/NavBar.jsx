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
                className="inline-flex items-center px-4 py-2 text-sm font-bold text-white hover:text-futuristic-yellow-400 transition-colors border-b-2 border-transparent hover:border-futuristic-yellow-400 pb-1"
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
                    className="absolute left-0 z-10 mt-1 w-56 py-2 bg-futuristic-blue-900/95 backdrop-blur-sm border border-futuristic-blue-500/50 rounded-lg shadow-glow-blue-lg"
                >
                    {items.map((item, index) => (
                        <a 
                            key={index} 
                            href={item.href} 
                            className="block px-4 py-2 text-white hover:bg-futuristic-blue-700 hover:text-futuristic-yellow-400 transition-colors text-sm"
                        >
                            {item.label}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

const Navbar = () => {
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user, loading, signOut } = useAuth();

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
        router.refresh();
    };

    const movieQuickFilters = [
        { href: '/movies', label: 'All Movies' },
        { href: '/trending-movies', label: 'Trending' },
        { href: '/upcoming-movies', label: 'Upcoming' },
        { href: '/movies?daysPast=7', label: 'New Releases' },
        { href: '/movies?minRating=8', label: 'Top Rated (8+)' },
        { href: '/movies?dateRange=thisYear', label: 'This Year' },
    ];

    const seriesQuickFilters = [
        { href: '/series', label: 'All Series' },
        { href: '/trending-series', label: 'Trending' },
        { href: '/upcoming-series', label: 'Upcoming' },
        { href: '/series?daysPast=7', label: 'New Releases' },
        { href: '/series?minRating=8', label: 'Top Rated (8+)' },
        { href: '/series?dateRange=thisYear', label: 'This Year' },
    ];

    return (
        <nav className="bg-futuristic-blue-950/90 backdrop-blur-md border-b border-futuristic-blue-500/30 shadow-glow-blue p-4 sticky top-0 z-50">
            <div className="container mx-auto flex items-center justify-between gap-4">
                {/* Logo */}
                <a className="text-futuristic-yellow-400 text-3xl font-bold cursor-pointer futuristic-text-glow-yellow hover:text-futuristic-yellow-300 transition-colors flex-shrink-0" href="/">
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
                        <>
                            <a 
                                href="/profile" 
                                className="flex items-center gap-2 text-white font-semibold hover:text-futuristic-yellow-400 transition-colors"
                                title="Profile"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>Profile</span>
                            </a>
                            <button
                                onClick={handleSignOut}
                                className="text-white/70 hover:text-white transition-colors text-sm"
                            >
                                Sign Out
                            </button>
                        </>
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

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden text-white hover:text-futuristic-yellow-400 transition-colors p-2"
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

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden mt-4 border-t border-futuristic-blue-500/30 pt-4">
                    <div className="flex flex-col gap-4">
                        {/* Mobile Search */}
                        <div className="px-2">
                            <QuickSearch isNavbar={true} />
                        </div>
                        
                        {/* Movies Section */}
                        <div className="flex flex-col gap-2">
                            <a 
                                href="/movies" 
                                className="text-futuristic-yellow-400 font-semibold text-sm mb-1 pl-4"
                            >
                                Movies
                            </a>
                            {movieQuickFilters.map((filter, index) => (
                                <a 
                                    key={index}
                                    href={filter.href} 
                                    className="text-white hover:text-futuristic-yellow-400 transition-colors pl-8 py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400"
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
                                className="text-futuristic-yellow-400 font-semibold text-sm mb-1 pl-4"
                            >
                                Series
                            </a>
                            {seriesQuickFilters.map((filter, index) => (
                                <a 
                                    key={index}
                                    href={filter.href} 
                                    className="text-white hover:text-futuristic-yellow-400 transition-colors pl-8 py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {filter.label}
                                </a>
                            ))}
                        </div>
                        
                        {loading ? null : (user && user.id) ? (
                            <>
                                <a 
                                    href="/profile" 
                                    className="flex items-center gap-2 text-white font-semibold hover:text-futuristic-yellow-400 transition-colors py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400 pl-4"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span>Profile</span>
                                </a>
                                <button
                                    onClick={() => {
                                        handleSignOut();
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="text-white/70 hover:text-white transition-colors py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400 pl-4 text-left"
                                >
                                    Sign Out
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
