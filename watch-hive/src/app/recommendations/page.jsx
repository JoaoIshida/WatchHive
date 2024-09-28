"use client";
import React, { useState, useCallback } from 'react';
import debounce from 'lodash.debounce';

const MovieRecommendationPage = () => {
    const [movieInputs, setMovieInputs] = useState(['', '', '', '']);
    const [suggestions, setSuggestions] = useState([[], [], [], []]);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);

    // Function to fetch movie suggestions from API
    const fetchMovieSuggestions = async (query, index) => {
        if (query.trim().length === 0) {
            return setSuggestions(prev => {
                const newSuggestions = [...prev];
                newSuggestions[index] = [];
                return newSuggestions;
            });
        }

        try {
            const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            setSuggestions(prev => {
                const newSuggestions = [...prev];
                newSuggestions[index] = data.results || [];
                return newSuggestions;
            });
        } catch (error) {
            console.error('Error fetching movie suggestions:', error);
        }
    };


    // Debounce the search function to avoid excessive API calls
    const debounceFetchSuggestions = useCallback(debounce(fetchMovieSuggestions, 300), []);

    const handleInputChange = (index, value) => {
        const newInputs = [...movieInputs];
        newInputs[index] = value;
        setMovieInputs(newInputs);

        // Call the debounced function for fetching movie suggestions
        debounceFetchSuggestions(value, index);
    };

    const handleMovieSelect = (movie, index) => {
        const newInputs = [...movieInputs];
        newInputs[index] = movie.title;
        setMovieInputs(newInputs);

        // Clear suggestions after selecting a movie
        setSuggestions(prev => {
            const newSuggestions = [...prev];
            newSuggestions[index] = [];
            return newSuggestions;
        });
    };

    const handleRecommendation = async () => {
        setLoading(true);
        try {
            // Search for movie IDs based on input
            const searchResponses = await Promise.all(
                movieInputs
                    .filter(movie => movie) // Filter out empty inputs
                    .map(movie =>
                        fetch(`/api/search?query=${encodeURIComponent(movie)}`)
                            .then(res => res.json())
                    )
            );

            const movieIds = searchResponses.map(response => response.results[0]?.id).filter(Boolean);

            // Get recommendations based on movie IDs
            const recommendationResponse = await fetch('/api/recommendations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ movieIds }),
            });

            const recommendationData = await recommendationResponse.json();
            setRecommendations(recommendationData.recommendations);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold mb-4">Movie Mixer</h1>
            <p>Enter 2 to 4 movies you like, and we'll recommend something that combines them!</p>

            <div className="flex flex-col gap-4 mb-4">
                {movieInputs.map((movie, index) => (
                    <div key={index} className="relative">
                        <input
                            value={movie}
                            onChange={(e) => handleInputChange(index, e.target.value)}
                            className="border border-gray-300 rounded p-2 w-full"
                            placeholder={`Movie ${index + 1}`}
                        />

                        {/* Dropdown for movie suggestions */}
                        {suggestions[index].length > 0 && (
                            <ul className="absolute z-10 bg-white border border-gray-300 rounded shadow-lg mt-1 max-h-48 overflow-y-auto w-full">
                                {suggestions[index].map((suggestion) => (
                                    <li
                                        key={suggestion.id}
                                        onClick={() => handleMovieSelect(suggestion, index)}
                                        className="p-2 cursor-pointer hover:bg-gray-200"
                                    >
                                        {suggestion.title}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={handleRecommendation}
                className="bg-blue-500 text-white rounded p-2"
                disabled={loading}
            >
                {loading ? 'Loading...' : 'Get Recommendations'}
            </button>

            {recommendations.length > 0 && (
                <div className="mt-6">
                    <h2 className="text-2xl font-semibold mb-2">Recommended Movies</h2>
                    <ul className="list-disc pl-6">
                        {recommendations.map(movie => (
                            <li key={movie.id}>{movie.title}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MovieRecommendationPage;
