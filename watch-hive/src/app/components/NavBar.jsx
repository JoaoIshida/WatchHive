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
                    <img src="/watchhive-logo.png" alt="Watch Hive Logo" className="inline h-8 w-auto mr-2 align-middle" />
                </a>
                <div className='flex items-center justify-between gap-6'>
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
                <a href="/profile" className="text-white font-semibold hover:text-futuristic-yellow-400 transition-colors">
                    Profile
                </a>
            </div>
            {showSearch && (
                <div className="container mx-auto px-4 pb-4">
                    <QuickSearch onClose={() => setShowSearch(false)} isNavbar={true} />
                </div>
            )}
        </nav>
    );
};

export default Navbar;
