"use client";
import { useState, useEffect } from 'react';
import WatchProviders from './WatchProviders';
import { checkMovieInTheaters } from '../utils/theaterHelper';

const WatchProvidersSection = ({ flatrate, rent, buy, title, mediaType = 'movie', movieId }) => {
    const [inTheaters, setInTheaters] = useState(false);
    const [checkingTheater, setCheckingTheater] = useState(false);

    // Check if movie is in theaters (only for movies)
    useEffect(() => {
        if (mediaType === 'movie' && movieId) {
            setCheckingTheater(true);
            checkMovieInTheaters(movieId)
                .then(result => {
                    setInTheaters(result);
                    setCheckingTheater(false);
                })
                .catch(() => {
                    setCheckingTheater(false);
                });
        }
    }, [movieId, mediaType]);

    const hasProviders = (flatrate && flatrate.length > 0) || 
                        (rent && rent.length > 0) || 
                        (buy && buy.length > 0) ||
                        inTheaters;

    if (!hasProviders) {
        const searchQuery = encodeURIComponent(`where to watch ${title}`);
        const googleSearchUrl = `https://www.google.com/search?q=${searchQuery}`;

        return (
            <div className="futuristic-card p-6">
                <p className="text-white text-base font-semibold mb-4 text-center">No information available on where to watch</p>
                <a
                    href={googleSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="futuristic-button-yellow flex items-center justify-center gap-2 w-full"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Search on Google</span>
                </a>
            </div>
        );
    }

    return (
        <div className="futuristic-card p-4 space-y-4">
            {inTheaters && mediaType === 'movie' && (
                <div className="mb-4">
                    <p className="text-sm font-semibold text-futuristic-yellow-400/90 mb-3">In Theaters</p>
                    <div className="flex flex-wrap gap-2">
                        <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(`${title} showtimes theaters`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative flex items-center justify-center bg-futuristic-blue-800/60 hover:bg-futuristic-blue-700/80 border border-futuristic-yellow-500/30 hover:border-futuristic-yellow-400/60 rounded-lg px-4 py-2 transition-all hover:scale-105 hover:shadow-glow-yellow"
                            title="Find showtimes near you"
                        >
                            <svg className="w-6 h-6 text-futuristic-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="text-sm text-futuristic-yellow-400 font-medium">Find Showtimes</span>
                        </a>
                    </div>
                </div>
            )}
            {flatrate && flatrate.length > 0 && (
                <WatchProviders providers={flatrate} type="flatrate" />
            )}
            {rent && rent.length > 0 && (
                <WatchProviders providers={rent} type="rent" />
            )}
            {buy && buy.length > 0 && (
                <WatchProviders providers={buy} type="buy" />
            )}
        </div>
    );
};

export default WatchProvidersSection;

