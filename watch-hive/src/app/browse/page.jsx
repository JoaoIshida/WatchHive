"use client";
import React, { useState, useCallback, useEffect } from 'react';
import debounce from 'lodash.debounce';
import ImageWithFallback from '../components/ImageWithFallback';
import LoadingSpinner from '../components/LoadingSpinner';
import { highlightText } from '../utils/highlightText';

function matchesQuery(text, q) {
    if (!text || !q?.trim()) return false;
    return String(text).toLowerCase().includes(q.trim().toLowerCase());
}

const BrowsePage = () => {
    const [query, setQuery] = useState('');
    const [showCollections, setShowCollections] = useState(true);
    const [showLists, setShowLists] = useState(true);
    const [collections, setCollections] = useState([]);
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const fetchResults = async (searchQuery) => {
        if (!searchQuery.trim()) {
            setCollections([]);
            setLists([]);
            setHasSearched(false);
            return;
        }

        setLoading(true);
        setHasSearched(true);

        const promises = [];

        if (showCollections) {
            promises.push(
                fetch(`/api/collections/search?query=${encodeURIComponent(searchQuery)}`)
                    .then(r => r.ok ? r.json() : { results: [] })
                    .catch(() => ({ results: [] }))
            );
        } else {
            promises.push(Promise.resolve({ results: [] }));
        }

        if (showLists) {
            promises.push(
                fetch(`/api/public-lists?query=${encodeURIComponent(searchQuery)}`)
                    .then(r => r.ok ? r.json() : { lists: [] })
                    .catch(() => ({ lists: [] }))
            );
        } else {
            promises.push(Promise.resolve({ lists: [] }));
        }

        const [collectionData, listData] = await Promise.all(promises);
        setCollections(collectionData.results || []);
        setLists(listData.lists || []);
        setLoading(false);
    };

    const debouncedFetch = useCallback(debounce(fetchResults, 400), [showCollections, showLists]);

    const handleQueryChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        debouncedFetch(val);
    };

    useEffect(() => {
        if (query.trim()) {
            debouncedFetch(query);
        }
    }, [showCollections, showLists]);

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <h1 className="text-4xl font-bold text-amber-500 mb-2">Collections & Lists</h1>
            <p className="text-white/60 mb-8">Search movie collections from TMDB and public user lists.</p>

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={query}
                        onChange={handleQueryChange}
                        placeholder="Search collections or lists..."
                        className="w-full px-4 py-3 pl-10 bg-charcoal-800 border border-charcoal-600 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showCollections}
                            onChange={() => setShowCollections(!showCollections)}
                            className="w-4 h-4 rounded border-charcoal-600 bg-charcoal-800 text-amber-500 focus:ring-amber-500 accent-amber-500"
                        />
                        <span className="text-white text-sm font-medium">Collections</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showLists}
                            onChange={() => setShowLists(!showLists)}
                            className="w-4 h-4 rounded border-charcoal-600 bg-charcoal-800 text-amber-500 focus:ring-amber-500 accent-amber-500"
                        />
                        <span className="text-white text-sm font-medium">Public Lists</span>
                    </label>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <LoadingSpinner />
                </div>
            )}

            {!loading && hasSearched && collections.length === 0 && lists.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-white/60 text-lg">No results found. Try a different search term.</p>
                </div>
            )}

            {!loading && !hasSearched && (
                <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-white/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-white/40 text-lg">Search for movie collections or browse public lists</p>
                </div>
            )}

            {/* Collections Results */}
            {!loading && collections.length > 0 && showCollections && (
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-amber-500 mb-4">
                        Collections ({collections.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {collections.map((collection) => {
                            const matchInName = matchesQuery(collection.name, query);
                            const matchInOverview = matchesQuery(collection.overview, query);
                            const matchLabels = [];
                            if (matchInName) matchLabels.push('name');
                            if (matchInOverview) matchLabels.push('description');
                            return (
                                <a
                                    key={collection.id}
                                    href={`/collections/${collection.id}`}
                                    className="futuristic-card p-4 flex gap-4 hover:border-amber-500/50 transition-all group"
                                >
                                    <div className="flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden bg-charcoal-800">
                                        <ImageWithFallback
                                            src={collection.poster_path ? `https://image.tmdb.org/t/p/w154${collection.poster_path}` : null}
                                            alt={collection.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {matchLabels.length > 0 && (
                                            <p className="text-amber-500/80 text-xs mb-1">
                                                Matches in: {matchLabels.join(' & ')}
                                            </p>
                                        )}
                                        <h3 className="text-white font-semibold group-hover:text-amber-500 transition-colors truncate">
                                            {query.trim() ? highlightText(collection.name || '', query) : (collection.name || '')}
                                        </h3>
                                        {collection.overview && (
                                            <p className="text-white/50 text-sm mt-1 line-clamp-2">
                                                {query.trim() ? highlightText(collection.overview, query) : collection.overview}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0 self-center">
                                        <svg className="w-5 h-5 text-white/30 group-hover:text-amber-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Public Lists Results */}
            {!loading && lists.length > 0 && showLists && (
                <div>
                    <h2 className="text-2xl font-bold text-amber-500 mb-4">
                        Public Lists ({lists.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {lists.map((list) => {
                            const matchInName = matchesQuery(list.name, query);
                            const matchInDesc = matchesQuery(list.description, query);
                            const matchLabels = [];
                            if (matchInName) matchLabels.push('name');
                            if (matchInDesc) matchLabels.push('description');
                            return (
                                <a
                                    key={list.id}
                                    href={`/lists/${list.id}`}
                                    className="futuristic-card p-4 flex gap-4 hover:border-amber-500/50 transition-all group"
                                >
                                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {matchLabels.length > 0 && (
                                            <p className="text-amber-500/80 text-xs mb-1">
                                                Matches in: {matchLabels.join(' & ')}
                                            </p>
                                        )}
                                        <h3 className="text-white font-semibold group-hover:text-amber-500 transition-colors truncate">
                                            {query.trim() ? highlightText(list.name || '', query) : (list.name || '')}
                                        </h3>
                                        {list.description && (
                                            <p className="text-white/50 text-sm mt-1 line-clamp-2">
                                                {query.trim() ? highlightText(list.description, query) : list.description}
                                            </p>
                                        )}
                                        <p className="text-white/30 text-xs mt-1">
                                            Created {new Date(list.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 self-center">
                                        <svg className="w-5 h-5 text-white/30 group-hover:text-amber-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
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

export default BrowsePage;
