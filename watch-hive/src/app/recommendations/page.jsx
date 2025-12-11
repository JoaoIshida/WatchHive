"use client";
import React, { useState, useCallback } from 'react';
import debounce from 'lodash.debounce';
import ImageWithFallback from '../components/ImageWithFallback';
import ContentCard from '../components/ContentCard';
import LoadingSpinner from '../components/LoadingSpinner';
import LoadingCard from '../components/LoadingCard';

const RecommendationsPage = () => {
    const [inputs, setInputs] = useState(['', '', '', '']);
    const [suggestions, setSuggestions] = useState([[], [], [], []]);
    const [selectedItems, setSelectedItems] = useState([null, null, null, null]);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mediaType, setMediaType] = useState('both'); // 'movie', 'tv', or 'both'

    // Function to fetch suggestions from API
    const fetchSuggestions = async (query, index) => {
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
            
            // Filter based on media type preference
            let filtered = Array.isArray(data) ? data : (data.results || []);
            
            if (mediaType === 'movie') {
                filtered = filtered.filter(item => item.media_type === 'movie');
            } else if (mediaType === 'tv') {
                filtered = filtered.filter(item => item.media_type === 'tv');
            } else {
                filtered = filtered.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
            }

            setSuggestions(prev => {
                const newSuggestions = [...prev];
                newSuggestions[index] = filtered.slice(0, 5); // Limit to 5 suggestions
                return newSuggestions;
            });
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    };

    // Debounce the search function
    const debounceFetchSuggestions = useCallback(debounce(fetchSuggestions, 300), [mediaType]);

    const handleInputChange = (index, value) => {
        const newInputs = [...inputs];
        newInputs[index] = value;
        setInputs(newInputs);
        debounceFetchSuggestions(value, index);
    };

    const handleItemSelect = (item, index) => {
        const newInputs = [...inputs];
        const newSelectedItems = [...selectedItems];
        
        newInputs[index] = item.title || item.name;
        newSelectedItems[index] = item;
        
        setInputs(newInputs);
        setSelectedItems(newSelectedItems);

        // Clear suggestions after selecting
        setSuggestions(prev => {
            const newSuggestions = [...prev];
            newSuggestions[index] = [];
            return newSuggestions;
        });
    };

    const handleRemoveItem = (index) => {
        const newInputs = [...inputs];
        const newSelectedItems = [...selectedItems];
        
        newInputs[index] = '';
        newSelectedItems[index] = null;
        
        setInputs(newInputs);
        setSelectedItems(newSelectedItems);
    };

    const handleRecommendation = async () => {
        const validItems = selectedItems.filter(item => item !== null);
        
        if (validItems.length < 2) {
            alert('Please select at least 2 movies or series');
            return;
        }

        setLoading(true);
        try {
            const movieIds = validItems
                .filter(item => item.media_type === 'movie')
                .map(item => item.id);
            
            const seriesIds = validItems
                .filter(item => item.media_type === 'tv')
                .map(item => item.id);

            const recommendationResponse = await fetch('/api/recommendations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    movieIds: movieIds.length > 0 ? movieIds : undefined,
                    seriesIds: seriesIds.length > 0 ? seriesIds : undefined,
                    mediaType: mediaType === 'both' ? undefined : mediaType,
                }),
            });

            const recommendationData = await recommendationResponse.json();
            setRecommendations(recommendationData.recommendations || []);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            alert('Failed to fetch recommendations. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const clearAll = () => {
        setInputs(['', '', '', '']);
        setSelectedItems([null, null, null, null]);
        setRecommendations([]);
        setSuggestions([[], [], [], []]);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2 text-amber-500">Content Mixer</h1>
                <p className="text-white text-lg">
                    Enter 2 to 4 movies or series you like, and we'll recommend something that combines them!
                </p>
            </div>

            {/* Media Type Selector */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-amber-500 mb-2">
                    Search for:
                </label>
                <div className="flex gap-4">
                    <button
                        onClick={() => setMediaType('both')}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            mediaType === 'both'
                                ? 'bg-charcoal-800 text-white shadow-subtle'
                                : 'bg-charcoal-800/50 text-white border border-charcoal-700/50 hover:bg-charcoal-700 hover:border-amber-500/50'
                        }`}
                    >
                        Both
                    </button>
                    <button
                        onClick={() => setMediaType('movie')}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            mediaType === 'movie'
                                ? 'bg-charcoal-800 text-white shadow-subtle'
                                : 'bg-charcoal-800/50 text-white border border-charcoal-700/50 hover:bg-charcoal-700 hover:border-amber-500/50'
                        }`}
                    >
                        Movies Only
                    </button>
                    <button
                        onClick={() => setMediaType('tv')}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            mediaType === 'tv'
                                ? 'bg-charcoal-800 text-white shadow-subtle'
                                : 'bg-charcoal-800/50 text-white border border-charcoal-700/50 hover:bg-charcoal-700 hover:border-amber-500/50'
                        }`}
                    >
                        Series Only
                    </button>
                </div>
            </div>

            {/* Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {inputs.map((input, index) => (
                    <div key={index} className="relative">
                        {selectedItems[index] ? (
                            <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3 flex-1">
                                            <ImageWithFallback
                                                src={selectedItems[index].poster_path ? `https://image.tmdb.org/t/p/w92${selectedItems[index].poster_path}` : null}
                                                alt={selectedItems[index].title || selectedItems[index].name}
                                                className="w-16 h-24 object-cover rounded"
                                            />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-lg">
                                                    {selectedItems[index].title || selectedItems[index].name}
                                                </h3>
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                    {selectedItems[index].media_type === 'movie' ? 'Movie' : 'TV Series'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 line-clamp-2">
                                                {selectedItems[index].overview}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveItem(index)}
                                        className="ml-2 text-red-500 hover:text-red-700"
                                        aria-label="Remove"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <input
                                    value={input}
                                    onChange={(e) => handleInputChange(index, e.target.value)}
                                    className="bg-charcoal-900/80 border-2 border-charcoal-700/50 rounded-lg p-3 w-full text-white placeholder-gray-400 focus:border-amber-500 focus:shadow-subtle focus:outline-none transition-all"
                                    placeholder={`${mediaType === 'movie' ? 'Movie' : mediaType === 'tv' ? 'Series' : 'Movie or Series'} ${index + 1}`}
                                />
                                {suggestions[index].length > 0 && (
                                    <ul className="absolute z-10 bg-white border-2 border-gray-200 rounded-lg shadow-xl mt-1 max-h-64 overflow-y-auto w-full">
                                        {suggestions[index].map((suggestion) => (
                                            <li
                                                key={suggestion.id}
                                                onClick={() => handleItemSelect(suggestion, index)}
                                                className="p-3 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <ImageWithFallback
                                                        src={suggestion.poster_path ? `https://image.tmdb.org/t/p/w92${suggestion.poster_path}` : null}
                                                        alt={suggestion.title || suggestion.name}
                                                        className="w-12 h-16 object-cover rounded"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">
                                                                {suggestion.title || suggestion.name}
                                                            </span>
                                                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                                                {suggestion.media_type === 'movie' ? 'Movie' : 'TV'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 line-clamp-1">
                                                            {suggestion.overview}
                                                        </p>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mb-8">
                <button
                    onClick={handleRecommendation}
                    disabled={loading || selectedItems.filter(item => item !== null).length < 2}
                    className="futuristic-button-yellow px-8 py-3 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Getting Recommendations...
                        </>
                    ) : (
                        'Get Recommendations'
                    )}
                </button>
                <button
                    onClick={clearAll}
                    className="futuristic-button px-6 py-3"
                >
                    Clear All
                </button>
            </div>

            {/* Recommendations Display */}
            {loading && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold mb-4 text-amber-500">
                        Finding Recommendations...
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <LoadingCard count={12} />
                    </div>
                </div>
            )}
            {recommendations.length > 0 && !loading && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold mb-4 text-amber-500">
                        Recommended {mediaType === 'movie' ? 'Movies' : mediaType === 'tv' ? 'Series' : 'Content'} ({recommendations.length})
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {recommendations.map((item) => {
                            const link = item.media_type === 'movie' 
                                ? `/movies/${item.id}` 
                                : `/series/${item.id}`;
                            
                            return (
                                <ContentCard
                                    key={`${item.media_type}-${item.id}`}
                                    item={item}
                                    mediaType={item.media_type}
                                    href={link}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {recommendations.length === 0 && !loading && selectedItems.filter(item => item !== null).length >= 2 && (
                <div className="text-center py-8 text-white">
                    <p className="text-lg mb-2">No recommendations found.</p>
                    <p className="text-amber-500/80">Try selecting different movies or series.</p>
                </div>
            )}
        </div>
    );
};

export default RecommendationsPage;
