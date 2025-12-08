"use client";
import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

const KeywordSearch = forwardRef(({ selectedKeywords = [], onKeywordsChange }, ref) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true); // Always open
    const [isFocused, setIsFocused] = useState(false);
    const searchTimeoutRef = useRef(null);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Expose focus method to parent
    useImperativeHandle(ref, () => ({
        focus: () => {
            inputRef.current?.focus();
        }
    }));

    // Search for keywords
    const searchKeywords = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/keywords?query=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                // Filter out already selected keywords
                const selectedIds = selectedKeywords.map(k => k.id);
                const filteredResults = (data.results || []).filter(
                    keyword => !selectedIds.includes(keyword.id)
                );
                setSearchResults(filteredResults.slice(0, 10)); // Limit to 10 results
            }
        } catch (error) {
            console.error('Error searching keywords:', error);
            setSearchResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedKeywords]);

    // Debounced search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery.length >= 2) {
            searchTimeoutRef.current = setTimeout(() => {
                searchKeywords(searchQuery);
            }, 300);
        } else {
            setSearchResults([]);
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, searchKeywords]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsExpanded(false);
                setIsFocused(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectKeyword = (keyword) => {
        const newKeywords = [...selectedKeywords, keyword];
        onKeywordsChange(newKeywords);
        setSearchQuery('');
        setSearchResults([]);
        inputRef.current?.focus();
    };

    const handleRemoveKeyword = (keywordId) => {
        const newKeywords = selectedKeywords.filter(k => k.id !== keywordId);
        onKeywordsChange(newKeywords);
    };

    const handleInputFocus = () => {
        setIsFocused(true);
        setIsExpanded(true);
    };

    const showDropdown = (isFocused || searchResults.length > 0) && isExpanded;

    return (
        <div ref={containerRef} className="relative">
            {/* Header - Always visible */}
            <div className="w-full flex items-center justify-between mb-2 text-sm font-semibold text-futuristic-yellow-400/90">
                <span className="flex items-center gap-2">
                    Keywords
                    {selectedKeywords.length > 0 && (
                        <span className="px-1.5 py-0.5 text-xs bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-full">
                            {selectedKeywords.length}
                        </span>
                    )}
                </span>
            </div>

            {/* Content - Always visible */}
            <div className="max-h-[400px] opacity-100">
                {/* Selected keywords */}
                {selectedKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedKeywords.map((keyword) => (
                            <span
                                key={keyword.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-futuristic-yellow-500/20 text-futuristic-yellow-400 rounded-lg text-xs font-medium border border-futuristic-yellow-500/30"
                            >
                                {keyword.name}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveKeyword(keyword.id)}
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
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={handleInputFocus}
                        placeholder="Search keywords..."
                        className="w-full bg-futuristic-blue-800/80 border border-futuristic-blue-500/40 text-white text-sm px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-futuristic-yellow-500/50 focus:ring-1 focus:ring-futuristic-yellow-500/30 hover:bg-futuristic-blue-700/80 transition-all placeholder-white/50"
                    />
                    {isLoading && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <svg className="animate-spin h-4 w-4 text-futuristic-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    )}
                    {!isLoading && searchQuery && (
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
                                {searchResults.map((keyword) => (
                                    <li key={keyword.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectKeyword(keyword)}
                                            className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-futuristic-blue-700/60 hover:text-futuristic-yellow-400 transition-colors"
                                        >
                                            {keyword.name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : searchQuery.length >= 2 && !isLoading ? (
                            <div className="px-3 py-4 text-sm text-white/60 text-center">
                                No keywords found for "{searchQuery}"
                            </div>
                        ) : searchQuery.length < 2 && isFocused ? (
                            <div className="px-3 py-4 text-sm text-white/60 text-center">
                                Type at least 2 characters to search
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
});

KeywordSearch.displayName = 'KeywordSearch';

export default KeywordSearch;

