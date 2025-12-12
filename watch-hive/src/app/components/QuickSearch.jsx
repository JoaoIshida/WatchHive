"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ImageWithFallback from './ImageWithFallback';
import { highlightText } from '../utils/highlightText';

const QuickSearch = ({ onClose, isNavbar = false, autoFocus = false }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef(null);
    const resultsRef = useRef(null);
    const inputRef = useRef(null);
    const router = useRouter();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                searchRef.current && 
                !searchRef.current.contains(event.target) &&
                resultsRef.current &&
                !resultsRef.current.contains(event.target)
            ) {
                setShowResults(false);
                // Only call onClose if it exists (for toggle-based search)
                if (onClose) onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setShowResults(false);
            return;
        }

        // Reduced debounce for faster results (150ms instead of 300ms)
        const debounceTimer = setTimeout(() => {
            searchContent(query);
        }, 150);

        return () => clearTimeout(debounceTimer);
    }, [query]);

    // Browser natively handles autofocus attribute when element is added to DOM
    // This works reliably on mobile within user gesture context (similar to GT's dialog approach)

    const searchContent = async (searchQuery) => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            // Use AbortController for request cancellation
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
            
            const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                setResults(data.slice(0, 6)); // Show top 6 results
                setShowResults(true);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error searching:', error);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResultClick = (item) => {
        const path = item.media_type === 'movie' 
            ? `/movies/${item.id}` 
            : `/series/${item.id}`;
        router.push(path);
        setShowResults(false);
        setQuery('');
        // Only call onClose if it exists (for toggle-based search)
        if (onClose) onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query)}`);
            setShowResults(false);
            setQuery('');
            // Only call onClose if it exists (for toggle-based search)
            if (onClose) onClose();
        }
    };

    return (
        <div className="relative w-full" ref={searchRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    autoFocus={autoFocus}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        if (results.length > 0 || query.trim()) {
                            setShowResults(true);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search movies and series..."
                    className={`futuristic-input w-full ${isNavbar ? 'pr-12' : 'pr-12'} pl-12`}
                />
                <svg
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-amber-500/90"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {loading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {showResults && results.length > 0 && (
                <div
                    ref={resultsRef}
                    className={`absolute ${isNavbar ? 'z-[110] w-[600px] left-1/2 -translate-x-1/2 bg-charcoal-900' : 'z-[100] w-full bg-charcoal-900/95'} mt-2 backdrop-blur-md border border-charcoal-500/50 rounded-lg shadow-subtle-lg max-h-96 overflow-y-auto scrollbar`}
                >
                    {results.map((item) => {
                        const title = item.title || item.name;
                        const mediaType = item.media_type === 'movie' ? 'Movie' : 'TV';
                        const releaseDate = item.release_date || item.first_air_date;
                        
                        return (
                            <div
                                key={`${item.media_type}-${item.id}`}
                                onClick={() => handleResultClick(item)}
                                className={`flex items-center gap-4 p-4 hover:bg-charcoal-700 cursor-pointer transition-colors border-b border-charcoal-800/50 last:border-b-0 ${isNavbar ? '' : ''}`}
                            >
                                <div className="relative flex-shrink-0" style={{ width: isNavbar ? '80px' : '64px', height: isNavbar ? '120px' : '96px' }}>
                                    <ImageWithFallback
                                        src={item.poster_path 
                                            ? `https://image.tmdb.org/t/p/w200${item.poster_path}` 
                                            : null}
                                        alt={title}
                                        className="object-cover w-full h-full rounded"
                                    />
                                    <div className="absolute top-1 right-1 bg-charcoal-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                        {mediaType}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`${isNavbar ? 'text-base' : 'text-sm'} font-semibold text-white truncate mb-1.5`}>
                                        {highlightText(title, query)}
                                    </h3>
                                    {item.overview && (
                                        <p className={`${isNavbar ? 'text-sm' : 'text-xs'} text-white/70 ${isNavbar ? 'line-clamp-3' : 'line-clamp-2'} mb-2`}>
                                            {item.overview}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-3 text-xs text-amber-500/80">
                                        {releaseDate && <span>{releaseDate}</span>}
                                        {item.vote_average && item.vote_average > 0 ? (
                                            <span className="flex items-center gap-1">
                                                ⭐ {item.vote_average.toFixed(1)}
                                            </span>
                                        ) : (
                                            <span className="text-white/60">No ratings</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {query.trim() && (
                        <div
                            onClick={() => {
                                router.push(`/search?q=${encodeURIComponent(query)}`);
                                setShowResults(false);
                                if (onClose) onClose();
                            }}
                            className="p-3 text-center text-amber-500 hover:bg-charcoal-700 cursor-pointer border-t border-charcoal-800/50 font-semibold"
                        >
                            View all results for "{query}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QuickSearch;

