"use client";
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import ImageWithFallback from '../components/ImageWithFallback';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate } from '../utils/dateFormatter';
import { getContentType } from '../utils/contentTypeHelper';

const SearchPageContent = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

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
        } catch (error) {
            console.error('Error fetching search results:', error);
            setResults([]); // Clear results on error
        } finally {
            setLoading(false); // Set loading to false after fetching
        }
    }, [router, pathname]);

    // Initialize from URL parameter on mount
    useEffect(() => {
        const urlQuery = searchParams.get('q');
        if (urlQuery) {
            const decodedQuery = decodeURIComponent(urlQuery);
            setQuery(decodedQuery);
            // Perform immediate search for URL parameter without updating URL again
            handleSearch(decodedQuery, false);
        }
        setInitialLoad(false);
    }, []); // Only run on mount

    // Effect to call handleSearch on query change (debounced, except for initial load)
    useEffect(() => {
        // Skip debounce on initial load if query came from URL
        if (initialLoad) {
            return;
        }

        const delayDebounceFn = setTimeout(() => {
            handleSearch(query, true);
        }, 300); // Debounce search for 300ms

        return () => clearTimeout(delayDebounceFn); // Cleanup on component unmount
    }, [query, initialLoad, handleSearch]); // Dependency array to trigger when query changes

    return (
        <div className="container mx-auto p-4 py-8">
            <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Search</h1>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for movies and series..."
                className="bg-futuristic-blue-900/80 border-2 border-futuristic-blue-500/50 rounded-lg p-4 w-full text-white placeholder-gray-400 focus:border-futuristic-yellow-500 focus:shadow-glow-yellow focus:outline-none transition-all text-lg"
            />

            {loading && <LoadingSpinner text="Searching..." />}

            {results.length > 0 && !loading && (
                <div className="mt-6">
                    <h2 className="text-2xl font-bold mb-4 text-futuristic-yellow-400 futuristic-text-glow-yellow">Search Results:</h2>
                    <div className="flex flex-col space-y-3">
                        {results.map((item) => {
                            const title = item.title || item.name;
                            const link = item.media_type === 'movie' 
                                ? `/movies/${item.id}` 
                                : `/series/${item.id}`;
                            const typeLabel = getContentType(item, item.media_type);
                            
                            return (
                                <a href={link} key={item.id} className="block">
                                    <div className="futuristic-card p-4 flex flex-row gap-4 cursor-pointer">
                                        <ImageWithFallback
                                            src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null}
                                            className="w-16 h-24 object-cover rounded"
                                            alt={title}
                                        />
                                        <div className='flex flex-col flex-1'>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-white text-lg">{title}</h3>
                                                <span className="text-xs bg-futuristic-blue-600 text-white px-2 py-1 rounded border border-futuristic-yellow-500/50">
                                                    {typeLabel}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-300 mt-1 line-clamp-2">{item.overview}</p>
                                            {(item.release_date || item.first_air_date) && (
                                                <p className="text-xs text-futuristic-yellow-400/80 mt-1">
                                                    {formatDate(item.release_date || item.first_air_date)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </a>
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
                <h1 className="text-4xl font-bold mb-6 text-futuristic-yellow-400 futuristic-text-glow-yellow">Search</h1>
                <div className="bg-futuristic-blue-900/80 border-2 border-futuristic-blue-500/50 rounded-lg p-4 w-full h-12 animate-pulse"></div>
                <LoadingSpinner text="Loading..." />
            </div>
        }>
            <SearchPageContent />
        </Suspense>
    );
};

export default SearchPage;
