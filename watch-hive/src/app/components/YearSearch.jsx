"use client";
import { useState, useEffect, useRef, useMemo } from 'react';

const YearSearch = ({ selectedYears = [], onYearsChange }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    const currentYear = new Date().getFullYear();
    
    // Generate year options (from 1900 to current year + 1)
    const allYears = useMemo(() => {
        const years = [];
        for (let year = currentYear + 1; year >= 1900; year--) {
            years.push(year);
        }
        return years;
    }, [currentYear]);

    // Filter years based on search query
    useEffect(() => {
        if (!searchQuery) {
            setSearchResults([]);
            return;
        }

        const query = searchQuery.trim();
        if (query.length === 0) {
            setSearchResults([]);
            return;
        }

        // Filter years that match the query and aren't already selected
        const filtered = allYears
            .filter(year => {
                const yearStr = year.toString();
                return yearStr.includes(query) && !selectedYears.includes(year);
            })
            .slice(0, 10); // Limit to 10 results

        setSearchResults(filtered);
    }, [searchQuery, selectedYears, allYears]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsFocused(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectYear = (year) => {
        const newYears = [...selectedYears, year].sort((a, b) => b - a); // Sort descending
        onYearsChange(newYears);
        setSearchQuery('');
        setSearchResults([]);
        inputRef.current?.focus();
    };

    const handleRemoveYear = (year) => {
        const newYears = selectedYears.filter(y => y !== year);
        onYearsChange(newYears);
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter' && searchQuery) {
            const year = parseInt(searchQuery, 10);
            if (year >= 1900 && year <= currentYear + 1 && !selectedYears.includes(year)) {
                handleSelectYear(year);
                e.preventDefault();
            }
        }
    };

    const showDropdown = (isFocused || searchResults.length > 0) && searchQuery.length > 0;

    return (
        <div ref={containerRef} className="relative">
            {/* Header - Always visible */}
            <div className="w-full flex items-center justify-between mb-2 text-sm font-semibold text-futuristic-yellow-400/90">
                <span className="flex items-center gap-2">
                    Year
                    {selectedYears.length > 0 && (
                        <span className="px-1.5 py-0.5 text-xs bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full">
                            {selectedYears.length}
                        </span>
                    )}
                </span>
            </div>

            {/* Content - Always visible */}
            <div className="max-h-[400px] opacity-100">
                {/* Selected years */}
                {selectedYears.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedYears.map((year) => (
                            <span
                                key={year}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-lg text-xs font-medium border border-futuristic-yellow-500/30"
                            >
                                {year}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveYear(year)}
                                    className="ml-0.5 hover:text-futuristic-yellow-300 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Search input */}
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        value={searchQuery}
                        onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty string or numeric input
                            if (value === '' || /^\d+$/.test(value)) {
                                setSearchQuery(value);
                            }
                        }}
                        onKeyDown={handleInputKeyDown}
                        onFocus={() => setIsFocused(true)}
                        placeholder="Search years..."
                        className="w-full bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 hover:bg-futuristic-blue-700/80 transition-all placeholder-white/50"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Search results dropdown */}
                {showDropdown && (
                    <div className="mt-1 max-h-48 overflow-y-auto scrollbar bg-futuristic-blue-900/95 border border-futuristic-blue-500/40 rounded-lg shadow-lg">
                        {searchResults.length > 0 ? (
                            <ul className="py-1">
                                {searchResults.map((year) => (
                                    <li key={year}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectYear(year)}
                                            className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-futuristic-blue-700/60 hover:text-futuristic-yellow-400 transition-colors"
                                        >
                                            {year}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : searchQuery.length > 0 && parseInt(searchQuery, 10) >= 1900 && parseInt(searchQuery, 10) <= currentYear + 1 && !selectedYears.includes(parseInt(searchQuery, 10)) ? (
                            <div className="px-3 py-2">
                                <button
                                    type="button"
                                    onClick={() => handleSelectYear(parseInt(searchQuery, 10))}
                                    className="w-full text-left px-3 py-2 text-sm text-futuristic-yellow-400 hover:bg-futuristic-blue-700/60 transition-colors font-medium"
                                >
                                    Press Enter or click to add "{searchQuery}"
                                </button>
                            </div>
                        ) : searchQuery.length > 0 ? (
                            <div className="px-3 py-4 text-sm text-white/60 text-center">
                                {parseInt(searchQuery, 10) < 1900 || parseInt(searchQuery, 10) > currentYear + 1
                                    ? `Year must be between 1900 and ${currentYear + 1}`
                                    : selectedYears.includes(parseInt(searchQuery, 10))
                                    ? `Year ${searchQuery} already selected`
                                    : 'No matching years found'}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
};

export default YearSearch;

