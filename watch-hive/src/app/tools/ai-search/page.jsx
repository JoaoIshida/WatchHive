"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import ImageWithFallback from '../../components/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import {
    loadAiSearchSession,
    saveAiSearchSession,
    clearAiSearchSession,
} from './aiSearchSession';

const MAX_QUERY_LENGTH = 200;
const INITIAL_VISIBLE_COUNT = 8;
const SHOW_MORE_STEP = 8;
const REQUEST_TIMEOUT_MS = 30_000;

async function fetchAiSearch(body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch('/api/ai-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Search failed');
        }

        return data;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Search timed out after 30 seconds. Please try again.');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

function resultKey(item) {
    return `${item.media_type}-${item.id}`;
}

function buildExcludeTitles(results) {
    return results.map((item) => {
        const year = item.release_date?.slice(0, 4) || item.gemini_year || '';
        return year ? `${item.title} (${year})` : item.title;
    });
}

const EXAMPLE_QUERIES = [
    'Horror movie with some comedy',
    'Feel-good series I can binge in a weekend',
    'Mind-bending sci-fi like Inception',
    'Animated family movie from the 90s',
];

function InlineSpinner() {
    return (
        <span
            className="inline-block w-4 h-4 border-2 border-charcoal-900/30 border-t-charcoal-900 rounded-full animate-spin flex-shrink-0"
            aria-hidden="true"
        />
    );
}

function getMatchTone(score) {
    if (score >= 80) {
        return { stroke: '#34d399', text: 'text-emerald-400', label: 'Strong match' };
    }
    if (score >= 60) {
        return { stroke: '#fbbf24', text: 'text-amber-400', label: 'Good match' };
    }
    return { stroke: '#9ca3af', text: 'text-white/50', label: 'Loose match' };
}

function MatchScoreRing({ score, note }) {
    if (!score) return null;

    const size = 36;
    const stroke = 3;
    const radius = (size - stroke) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;
    const tone = getMatchTone(score);

    return (
        <div
            className="flex items-center gap-1.5 flex-shrink-0"
            title={note ? `${score}%: ${note}` : `${score}% match`}
        >
            <div
                className="relative flex-shrink-0"
                style={{ width: size, height: size }}
                aria-label={`${score}% ${tone.label}`}
            >
                <svg
                    width={size}
                    height={size}
                    className="-rotate-90"
                    aria-hidden="true"
                >
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={stroke}
                        className="text-charcoal-700/70"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={tone.stroke}
                        strokeWidth={stroke}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                    />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${tone.text}`}>
                    {score}
                </span>
            </div>
            <span className={`text-xs font-semibold ${tone.text}`}>{tone.label}</span>
        </div>
    );
}

function AiSearchResultRow({ item }) {
    const href = item.media_type === 'movie' ? `/movies/${item.id}` : `/series/${item.id}`;

    return (
        <Link
            href={href}
            className="futuristic-card p-4 flex gap-4 hover:border-amber-500/40 transition-colors"
        >
            <ImageWithFallback
                src={
                    item.poster_path
                        ? `https://image.tmdb.org/t/p/w154${item.poster_path}`
                        : null
                }
                alt={item.title}
                className="w-16 h-24 object-cover rounded flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-semibold text-white text-lg">{item.title}</h3>
                    <span className="text-xs bg-charcoal-700 text-white/80 px-2 py-0.5 rounded">
                        {item.media_type === 'movie' ? 'Movie' : 'Series'}
                    </span>
                    {item.release_date && (
                        <span className="text-xs text-white/50">
                            {item.release_date.slice(0, 4)}
                        </span>
                    )}
                    <MatchScoreRing score={item.match_score} note={item.match_note} />
                </div>
                {item.match_note && (
                    <p className="text-xs text-white/45 mt-1">{item.match_note}</p>
                )}
                {item.reason && (
                    <p className="text-sm text-amber-500/90 mt-2 leading-relaxed">{item.reason}</p>
                )}
                {item.overview && (
                    <p className="text-sm text-white/50 mt-1 line-clamp-2">{item.overview}</p>
                )}
            </div>
        </Link>
    );
}

function AiSearchLoadingRows() {
    return (
        <div className="mt-6 space-y-3" aria-live="polite" aria-busy="true">
            <div className="flex items-center gap-2 text-sm text-amber-400/90">
                <InlineSpinner />
                <span>Beengie is finding titles that match your search…</span>
            </div>
            {[1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="futuristic-card p-4 flex gap-4 animate-pulse opacity-60"
                >
                    <div className="w-16 h-24 bg-charcoal-800/70 rounded flex-shrink-0" />
                    <div className="flex-1 space-y-2.5 pt-1">
                        <div className="h-4 w-2/5 bg-charcoal-800/70 rounded" />
                        <div className="h-3 w-24 bg-charcoal-800/50 rounded" />
                        <div className="h-3 w-full bg-charcoal-800/40 rounded" />
                        <div className="h-3 w-4/5 bg-charcoal-800/40 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}

const AiSearchPage = () => {
    const { user, loading: authLoading } = useAuth();
    const [query, setQuery] = useState('');
    const [mediaType, setMediaType] = useState('both');
    const [results, setResults] = useState([]);
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [canLoadMore, setCanLoadMore] = useState(false);
    const [activeQuery, setActiveQuery] = useState('');
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);
    const sessionReadyRef = useRef(false);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            clearAiSearchSession();
            setQuery('');
            setResults([]);
            setVisibleCount(INITIAL_VISIBLE_COUNT);
            setCanLoadMore(false);
            setActiveQuery('');
            setHasSearched(false);
            setError('');
            sessionReadyRef.current = true;
            setSessionReady(true);
            return;
        }

        const saved = loadAiSearchSession();
        if (saved) {
            setQuery(saved.query);
            setMediaType(saved.mediaType);
            setResults(saved.results);
            setVisibleCount(saved.visibleCount);
            setCanLoadMore(saved.canLoadMore);
            setActiveQuery(saved.activeQuery);
            setHasSearched(saved.hasSearched);
        }

        sessionReadyRef.current = true;
        setSessionReady(true);
    }, [authLoading, user]);

    useEffect(() => {
        if (!sessionReadyRef.current || loading || loadingMore || !user) return;

        if (!hasSearched) {
            clearAiSearchSession();
            return;
        }

        saveAiSearchSession({
            query,
            mediaType,
            results,
            visibleCount,
            canLoadMore,
            activeQuery,
            hasSearched,
        });
    }, [
        query,
        mediaType,
        results,
        visibleCount,
        canLoadMore,
        activeQuery,
        hasSearched,
        loading,
        loadingMore,
        user,
    ]);

    const visibleResults = results.slice(0, visibleCount);
    const hasHiddenResults = visibleCount < results.length;

    const mergeResults = (prev, incoming) => {
        const seen = new Set(prev.map(resultKey));
        const merged = [...prev];
        for (const item of incoming) {
            const key = resultKey(item);
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(item);
            }
        }
        return merged;
    };

    const handleSearch = async (searchQuery = query) => {
        if (!user) return;

        const trimmed = searchQuery.trim().slice(0, MAX_QUERY_LENGTH);
        if (!trimmed) return;

        setLoading(true);
        setError('');
        setHasSearched(true);
        setResults([]);
        setVisibleCount(INITIAL_VISIBLE_COUNT);
        setCanLoadMore(false);
        setActiveQuery(trimmed);

        try {
            const data = await fetchAiSearch({ query: trimmed, mediaType });

            const nextResults = data.results || [];
            setResults(nextResults);
            setCanLoadMore(nextResults.length >= INITIAL_VISIBLE_COUNT);
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
            setResults([]);
            setCanLoadMore(false);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = async () => {
        if (loadingMore) return;

        if (hasHiddenResults) {
            setVisibleCount((prev) => prev + SHOW_MORE_STEP);
            return;
        }

        if (!activeQuery) return;

        setLoadingMore(true);
        setError('');

        try {
            const data = await fetchAiSearch({
                query: activeQuery,
                mediaType,
                loadMore: true,
                excludeTitles: buildExcludeTitles(results),
                excludeIds: results.map((item) => item.id),
            });

            const incoming = data.results || [];
            if (incoming.length === 0) {
                setCanLoadMore(false);
            } else {
                setResults((prev) => mergeResults(prev, incoming));
                setVisibleCount((prev) => prev + SHOW_MORE_STEP);
                setCanLoadMore(data.hasMore !== false);
            }
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoadingMore(false);
        }
    };

    const showLoadMoreButton =
        visibleCount < results.length ||
        (results.length >= INITIAL_VISIBLE_COUNT && canLoadMore);

    const handleSubmit = (e) => {
        e.preventDefault();
        handleSearch();
    };

    const handleQueryKeyDown = (e) => {
        if (e.key !== 'Enter' || e.shiftKey) return;
        e.preventDefault();
        handleSearch();
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <Link href="/tools" className="text-sm text-amber-500/80 hover:text-amber-400 mb-4 inline-block">
                ← Back to Discover
            </Link>

            <div className="mb-8 flex flex-col sm:flex-row gap-5 sm:gap-6 items-start">
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                    <Image
                        src="/beengie/beengie-base.png"
                        alt="Beengie, the WatchHive mascot"
                        width={160}
                        height={160}
                        className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-lg"
                        priority
                    />
                </div>
                <div className="flex-1 min-w-0 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
                        <h1 className="text-4xl font-bold text-amber-500">AI Search</h1>
                        <span className="text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/40 px-2 py-1 rounded">
                            Beta
                        </span>
                    </div>
                    <p className="text-white/70 text-lg max-w-2xl">
                        Describe what you want to watch in plain language. Beengie will suggest titles that match your vibe.
                    </p>
                </div>
            </div>

            {authLoading ? (
                <div className="flex justify-center py-16">
                    <span className="inline-block w-8 h-8 border-2 border-white/20 border-t-amber-500 rounded-full animate-spin" aria-hidden="true" />
                </div>
            ) : !user ? (
                <div className="futuristic-card p-8 text-center max-w-xl mx-auto">
                    <p className="text-xl text-white mb-2">Sign in to try AI Search</p>
                    <p className="text-amber-500/80 mb-6">
                        This beta feature is available for WatchHive accounts. Sign in to ask Beengie for personalized suggestions.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }))}
                            className="futuristic-button-yellow px-6 py-3"
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signup' } }))}
                            className="futuristic-button px-6 py-3"
                        >
                            Sign Up
                        </button>
                    </div>
                </div>
            ) : (
            <>
            <form onSubmit={handleSubmit} className="mb-6">
                <label htmlFor="ai-search-input" className="block text-sm font-medium text-amber-500 mb-2">
                    What are you in the mood for?
                </label>
                <textarea
                    id="ai-search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value.slice(0, MAX_QUERY_LENGTH))}
                    onKeyDown={handleQueryKeyDown}
                    rows={3}
                    maxLength={MAX_QUERY_LENGTH}
                    placeholder='e.g. "I want a horror movie with some comedy"'
                    className="bg-charcoal-900/80 border-2 border-charcoal-700/50 rounded-lg p-4 w-full text-white placeholder-gray-400 focus:border-amber-500 focus:shadow-subtle focus:outline-none transition-all resize-none"
                />
                <p className="text-xs text-white/40 mt-1 text-right">
                    {query.length}/{MAX_QUERY_LENGTH}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-3">
                    <div className="flex gap-2">
                        {[
                            { value: 'both', label: 'Both' },
                            { value: 'movie', label: 'Movies' },
                            { value: 'tv', label: 'Series' },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setMediaType(option.value)}
                                className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${
                                    mediaType === option.value
                                        ? 'bg-charcoal-800 text-white shadow-subtle'
                                        : 'bg-charcoal-800/50 text-white border border-charcoal-700/50 hover:bg-charcoal-700 hover:border-amber-500/50'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="futuristic-button-yellow px-8 py-3 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2 sm:ml-auto"
                    >
                        {loading ? (
                            <>
                                <InlineSpinner />
                                Searching...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Search with AI
                            </>
                        )}
                    </button>
                </div>
            </form>

            <div className="mb-8">
                <p className="text-sm text-white/50 mb-2">Try an example:</p>
                <div className="flex flex-wrap gap-2">
                    {EXAMPLE_QUERIES.map((example) => (
                        <button
                            key={example}
                            type="button"
                            disabled={loading}
                            onClick={() => {
                                setQuery(example);
                                handleSearch(example);
                            }}
                            className="text-sm px-3 py-1.5 rounded-full border border-charcoal-700/60 text-white/70 hover:text-amber-400 hover:border-amber-500/50 transition-colors disabled:opacity-50"
                        >
                            {example}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300">
                    {error}
                </div>
            )}

            {loading && <AiSearchLoadingRows />}

            {!loading && results.length > 0 && (
                <div className="mt-4 space-y-6">
                    <h2 className="text-2xl font-bold text-amber-500">Suggestions</h2>

                    <div className="space-y-3">
                        {visibleResults.map((item) => (
                            <AiSearchResultRow key={resultKey(item)} item={item} />
                        ))}
                    </div>

                    {showLoadMoreButton && (
                        <div className="flex justify-center pt-2">
                            <button
                                type="button"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="futuristic-button px-8 py-3 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {loadingMore ? (
                                    <>
                                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" aria-hidden="true" />
                                        Loading more…
                                    </>
                                ) : (
                                    'Show more'
                                )}
                            </button>
                        </div>
                    )}

                    {loadingMore && !hasHiddenResults && (
                        <div className="space-y-3 opacity-60">
                            {[1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="futuristic-card p-4 flex gap-4 animate-pulse"
                                >
                                    <div className="w-16 h-24 bg-charcoal-800/70 rounded flex-shrink-0" />
                                    <div className="flex-1 space-y-2.5 pt-1">
                                        <div className="h-4 w-2/5 bg-charcoal-800/70 rounded" />
                                        <div className="h-3 w-24 bg-charcoal-800/50 rounded" />
                                        <div className="h-3 w-full bg-charcoal-800/40 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>
            )}

            {!loading && hasSearched && results.length === 0 && !error && sessionReady && (
                <div className="text-center py-8 text-white">
                    <p className="text-lg mb-2">No matches found.</p>
                    <p className="text-amber-500/80">Try describing the mood, genre, or similar titles you like.</p>
                </div>
            )}
            </>
            )}
        </div>
    );
};

export default AiSearchPage;
