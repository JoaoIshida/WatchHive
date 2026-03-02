"use client";
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import ImageWithFallback from '../components/ImageWithFallback';
import LoadingSpinner from '../components/LoadingSpinner';
import QuickActionsMenu from '../components/QuickActionsMenu';
import { formatDate } from '../utils/dateFormatter';
import { getContentType } from '../utils/contentTypeHelper';
import { highlightText } from '../utils/highlightText';
import { recentSearchesStorage } from '../lib/localStorage';

const SearchPageContent = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const [recentSearches, setRecentSearches] = useState([]);

    // Function to handle the search
    const handleSearch = useCallback(async (searchQuery, updateURL = true) => {
        if (!searchQuery) {
            setResults([]); // Clear results if input is empty
            // Update URL to remove query parameter
            if (updateURL) {
                router.replace(pathname);
            }
            return;
        }

        setLoading(true); // Set loading to true while fetching results

        try {
            // Update URL with search query
            if (updateURL) {
                const params = new URLSearchParams();
                params.set('q', searchQuery);
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            }

            const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch search results');
            }
            const data = await response.json();
            setResults(data); // Set search results
            recentSearchesStorage.add(searchQuery);
        } catch (error) {
            console.error('Error fetching search results:', error);
            setResults([]); // Clear results on error
        } finally {
            setLoading(false); // Set loading to false after fetching
        }
    }, [router, pathname]);

    // Sync with URL: when q param changes (e.g. from navbar search), update local state and run search
    const urlQuery = searchParams.get('q') || '';
    const decodedUrlQuery = urlQuery ? decodeURIComponent(urlQuery) : '';

    useEffect(() => {
        setQuery(decodedUrlQuery);
        if (decodedUrlQuery) {
            handleSearch(decodedUrlQuery, false);
        } else {
            setResults([]);
        }
        setInitialLoad(false);
    }, [decodedUrlQuery, handleSearch]); // Re-run when URL q changes (navbar search or in-page navigation)

    // Effect to call handleSearch on local query change (user typing in page input), debounced.
    // Skip when query matches URL (e.g. just synced from navbar) to avoid double fetch.
    useEffect(() => {
        if (initialLoad) return;
        if (query === decodedUrlQuery) return;

        const delayDebounceFn = setTimeout(() => {
            handleSearch(query, true);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query, initialLoad, handleSearch, decodedUrlQuery]);

    // Load recent searches when query is empty (for display below input)
    useEffect(() => {
        if (typeof window !== 'undefined' && !query.trim()) {
            setRecentSearches(recentSearchesStorage.getAll());
        }
    }, [query]);

    const handleRecentClick = (recentQuery) => {
        setQuery(recentQuery);
        handleSearch(recentQuery, true);
    };

    const handleRemoveRecent = (e, recentQuery) => {
        e.stopPropagation();
        recentSearchesStorage.remove(recentQuery);
        setRecentSearches(recentSearchesStorage.getAll());
    };

    return (
        <div className="container mx-auto p-4 py-8">
            <h1 className="text-4xl font-bold mb-6 text-amber-500">Search</h1>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for movies and series..."
                className="bg-charcoal-900/80 border-2 border-charcoal-700 rounded-lg p-4 w-full text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none transition-all text-lg"
            />

            {!query.trim() && recentSearches.length > 0 && (
                <div className="mt-3 p-3 bg-charcoal-900/50 border border-charcoal-700/50 rounded-lg">
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">Recent searches</p>
                    <div className="flex flex-wrap gap-2">
                        {recentSearches.map((entry) => (
                            <div
                                key={entry.query + (entry.timestamp || '')}
                                className="inline-flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-full bg-charcoal-800 border border-charcoal-600 group hover:border-amber-500/50 transition-colors"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleRecentClick(entry.query)}
                                    className="text-white hover:text-amber-500 text-sm"
                                >
                                    {entry.query}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => handleRemoveRecent(e, entry.query)}
                                    className="p-1 rounded-full text-white/50 hover:text-white hover:bg-charcoal-600 transition-colors"
                                    aria-label={`Remove ${entry.query} from recent`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading && <LoadingSpinner text="Searching..." />}

            {results.length > 0 && !loading && (
                <div className="mt-6">
                    <h2 className="text-2xl font-bold mb-4 text-amber-500">Search Results:</h2>
                    <div className="flex flex-col space-y-3">
                        {results.map((item) => {
                            const title = item.title || item.name;
                            const link = item.media_type === 'movie' 
                                ? `/movies/${item.id}` 
                                : `/series/${item.id}`;
                            const typeLabel = getContentType(item, item.media_type);
                            
                            return (
                                <div key={item.id} className="relative">
                                    <a href={link} className="block">
                                        <div className="futuristic-card p-4 flex flex-row gap-4 cursor-pointer">
                                            <ImageWithFallback
                                                src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null}
                                                className="w-16 h-24 object-cover rounded"
                                                alt={title}
                                            />
                                            <div className='flex flex-col flex-1'>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-white text-lg">{highlightText(title, query)}</h3>
                                                    <span className="text-xs bg-charcoal-800 text-white px-2 py-1 rounded border border-amber-500/50">
                                                        {typeLabel}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-300 mt-1 line-clamp-2">{item.overview}</p>
                                                {(item.release_date || item.first_air_date) && (
                                                    <p className="text-xs text-amber-500/80 mt-1">
                                                        {formatDate(item.release_date || item.first_air_date)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </a>
                                    <div className="absolute top-2 right-2 z-20" onClick={(e) => e.stopPropagation()}>
                                        <QuickActionsMenu
                                            itemId={item.id}
                                            mediaType={item.media_type}
                                            itemData={item}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const SearchPage = () => {
    return (
        <Suspense fallback={
            <div className="container mx-auto p-4 py-8">
                <h1 className="text-4xl font-bold mb-6 text-amber-500">Search</h1>
                <div className="bg-charcoal-900/80 border-2 border-charcoal-700 rounded-lg p-4 w-full h-12 animate-pulse"></div>
                <LoadingSpinner text="Loading..." />
            </div>
        }>
            <SearchPageContent />
        </Suspense>
    );
};

export default SearchPage;
