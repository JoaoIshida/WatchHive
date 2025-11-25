"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import QuickSearch from './QuickSearch';

const DropdownMenu = ({ label, items }) => {
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

    return (
        <div
            ref={dropdownRef}
            className="relative inline-block text-left"
        >
            <button
                className="inline-flex items-center px-4 py-2 text-sm font-bold text-white bg-futuristic-blue-700 border border-futuristic-blue-500 rounded-lg shadow-glow-blue hover:bg-futuristic-blue-600 hover:shadow-glow-blue-lg transition-all duration-300"
                onClick={() => setIsOpen(prev => !prev)}
            >
                {label}
                <svg
                    className={`w-5 h-5 ml-2 -mr-1 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 z-10 mt-2 w-48 py-2 bg-futuristic-blue-900/95 backdrop-blur-sm border border-futuristic-blue-500/50 rounded-lg shadow-glow-blue-lg">
                    {items.map((item, index) => (
                        <a key={index} href={item.href} className="block px-4 py-2 text-white hover:bg-futuristic-blue-700 hover:text-futuristic-yellow-400 transition-colors">
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
    const [language, setLanguage] = useState('en-US');
    const [showSearch, setShowSearch] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // useEffect(() => {
    //     // Load the language from localStorage or default to 'en-US'
    //     const savedLanguage = localStorage.getItem('language');
    //     if (savedLanguage) {
    //         setLanguage(savedLanguage);
    //     }
    // }, []);

    // const handleLanguageChange = (e) => {
    //     const newLanguage = e.target.value;
    //     setLanguage(newLanguage);
    //     localStorage.setItem('language', newLanguage);

    //     // Get current path and query parameters
    //     const currentPath = window.location.pathname;
    //     const searchParams = new URLSearchParams(window.location.search);
    //     searchParams.set('language', newLanguage);

    //     // Update the language in the current path without losing the current page
    //     router.push(`${currentPath}?${searchParams.toString()}`);
    // };

    return (
        <nav className="bg-futuristic-blue-950/90 backdrop-blur-md border-b border-futuristic-blue-500/30 shadow-glow-blue p-4 sticky top-0 z-50">
            <div className="container mx-auto flex items-center justify-between">
                <a className="text-futuristic-yellow-400 text-3xl font-bold cursor-pointer futuristic-text-glow-yellow hover:text-futuristic-yellow-300 transition-colors" href="/">
                    <img src="/watchhive-logo.png" alt="Watch Hive Logo" className="inline h-12 w-auto mr-2 align-middle scale-125" />
                </a>
                
                {/* Desktop Navigation */}
                <div className='hidden md:flex items-center justify-between gap-6'>
                    <DropdownMenu 
                        label="Trending"
                        items={[
                            { href: '/trending-movies', label: 'Trending Movies' },
                            { href: '/trending-series', label: 'Trending Series' }
                        ]}
                    />
                    <DropdownMenu 
                        label="Upcoming"
                        items={[
                            { href: '/upcoming-movies', label: 'Upcoming Movies' },
                            { href: '/upcoming-series', label: 'Upcoming Series' }
                        ]}
                    />
                    <a href="/movies" className="text-white font-semibold hover:text-futuristic-yellow-400 transition-colors border-b-2 border-transparent hover:border-futuristic-yellow-400 pb-1">
                        Movies
                    </a>
                    <a href="/series" className="text-white font-semibold hover:text-futuristic-yellow-400 transition-colors border-b-2 border-transparent hover:border-futuristic-yellow-400 pb-1">
                        Series
                    </a>
                    <button
                        onClick={() => setShowSearch(!showSearch)}
                        className="text-white font-semibold hover:text-futuristic-yellow-400 transition-colors"
                        title="Search"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>
                </div>
                
                {/* Desktop Profile Link */}
                <a href="/profile" className="hidden md:block text-white font-semibold hover:text-futuristic-yellow-400 transition-colors">
                    Profile
                </a>

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
                        <div className="flex flex-col gap-2">
                            <span className="text-futuristic-yellow-400 font-semibold text-sm mb-1">Trending</span>
                            <a 
                                href="/trending-movies" 
                                className="text-white hover:text-futuristic-yellow-400 transition-colors pl-4 py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Trending Movies
                            </a>
                            <a 
                                href="/trending-series" 
                                className="text-white hover:text-futuristic-yellow-400 transition-colors pl-4 py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Trending Series
                            </a>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-futuristic-yellow-400 font-semibold text-sm mb-1">Upcoming</span>
                            <a 
                                href="/upcoming-movies" 
                                className="text-white hover:text-futuristic-yellow-400 transition-colors pl-4 py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Upcoming Movies
                            </a>
                            <a 
                                href="/upcoming-series" 
                                className="text-white hover:text-futuristic-yellow-400 transition-colors pl-4 py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Upcoming Series
                            </a>
                        </div>
                        <a 
                            href="/movies" 
                            className="text-white font-semibold hover:text-futuristic-yellow-400 transition-colors py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400 pl-4"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Movies
                        </a>
                        <a 
                            href="/series" 
                            className="text-white font-semibold hover:text-futuristic-yellow-400 transition-colors py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400 pl-4"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Series
                        </a>
                        <a 
                            href="/profile" 
                            className="text-white font-semibold hover:text-futuristic-yellow-400 transition-colors py-2 border-l-2 border-transparent hover:border-futuristic-yellow-400 pl-4"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Profile
                        </a>
                        <button
                            onClick={() => {
                                setShowSearch(!showSearch);
                                setIsMobileMenuOpen(false);
                            }}
                            className="text-white font-semibold hover:text-futuristic-yellow-400 transition-colors py-2 text-left border-l-2 border-transparent hover:border-futuristic-yellow-400 pl-4"
                        >
                            Search
                        </button>
                    </div>
                </div>
            )}

            {showSearch && (
                <div className="container mx-auto px-4 pb-4">
                    <QuickSearch onClose={() => setShowSearch(false)} isNavbar={true} />
                </div>
            )}
        </nav>
    );
};

export default Navbar;
