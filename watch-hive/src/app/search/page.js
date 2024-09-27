"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';

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
            const response = await axios.get(`/api/search`, {
                params: { query: searchQuery },
            });
            setResults(response.data); // Set search results
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
        <div className="container mx-auto p-4">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a movie..."
                className="border p-2 w-full text-black"
            />

            {loading && <p className="mt-2">Loading...</p>}

            {results.length > 0 && !loading && (
                <div className="mt-4">
                    <h2 className="text-lg font-semibold">Search Results:</h2>
                    <div className="flex flex-col space-y-2">
                        {results.map((movie) => (
                            <div key={movie.id} className="border p-2 rounded flex flex-row gap-2">
                                <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} className="w-16 h-24" alt={movie.title} />
                                <div className='flex flex-col'>
                                    <h3 className="font-bold">{movie.title}</h3>
                                    <p>{movie.overview}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchPage;
