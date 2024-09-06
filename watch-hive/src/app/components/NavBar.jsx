"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const DropdownMenu = () => {
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
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-200 focus:outline-none"
                onClick={() => setIsOpen(prev => !prev)}
            >
                Trending
                <svg
                    className={`w-5 h-5 ml-2 -mr-1 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 z-10 mt-2 w-48 py-2 bg-white border border-gray-300 rounded-lg shadow-lg">
                    <a href="/trending-series">
                        <a className="block px-4 py-2 text-gray-700 hover:bg-gray-100">Trending Series</a>
                    </a>
                    <a href="/trending-movies">
                        <a className="block px-4 py-2 text-gray-700 hover:bg-gray-100">Trending Movies</a>
                    </a>
                </div>
            )}
        </div>
    );
};

const Navbar = () => {
    const router = useRouter();
    const [language, setLanguage] = useState('en-US');

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
        <nav className="bg-gray-800 p-4">
            <div className="container mx-auto flex items-center justify-between">
                <a className="text-white text-2xl font-bold cursor-pointer" href="/">Watch Hive</a>
                <div className='flex items-center justify-between gap-6'>
                    <DropdownMenu />
                    <a href="/movies">Movies</a>
                    <a href="/series">Series</a>
                </div>
                <a href="/profile">Profile</a>
                {/* <div>
                    <label htmlFor="language" className="text-white mr-4">Select Language:</label>
                    <select
                        id="language"
                        value={language}
                        onChange={handleLanguageChange}
                        className="p-2 border border-gray-300 rounded"
                    >
                        <option value="en-US">English</option>
                        <option value="pt-BR">Portuguese</option>
                    </select>
                </div> */}
            </div>
        </nav>
    );
};

export default Navbar;
