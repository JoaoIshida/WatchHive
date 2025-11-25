"use client";
import { useState, useEffect } from 'react';
import ImageWithFallback from '../components/ImageWithFallback';
import LoadingSpinner from '../components/LoadingSpinner';

const SearchPage = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    // Function to handle the search
    const handleSearch = async (searchQuery) => {
        if (!searchQuery) {
            setResults([]); // Clear results if input is empty
            return;
        }

        setLoading(true); // Set loading to true while fetching results

        try {
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
    };

    // Effect to call handleSearch on query change
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            handleSearch(query);
        }, 300); // Debounce search for 300ms

        return () => clearTimeout(delayDebounceFn); // Cleanup on component unmount
    }, [query]); // Dependency array to trigger when query changes

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
                            const typeLabel = item.media_type === 'movie' ? 'Movie' : 'TV Series';
                            
                            return (
                                <a href={link} key={item.id} className="block">
                                    <div className="futuristic-card p-4 flex flex-row gap-4 cursor-pointer">
                                        <ImageWithFallback
                                            src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/64x96?text=No+Image'}
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
                                            {item.release_date && (
                                                <p className="text-xs text-futuristic-yellow-400/80 mt-1">
                                                    {item.release_date || item.first_air_date}
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

export default SearchPage;
