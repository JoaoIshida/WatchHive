"use client";
import { useState } from 'react';

const TrailerPlayer = ({ trailerKey, title }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const thumbnailUrl = `https://img.youtube.com/vi/${trailerKey}/maxresdefault.jpg`;

    if (!trailerKey) return null;

    return (
        <div className="relative w-full futuristic-card overflow-hidden" style={{ paddingBottom: '56.25%' }}>
            {!isPlaying ? (
                <>
                    <img
                        src={thumbnailUrl}
                        alt={`${title} trailer thumbnail`}
                        className="absolute top-0 left-0 w-full h-full object-cover"
                        onError={(e) => {
                            e.target.src = `https://img.youtube.com/vi/${trailerKey}/hqdefault.jpg`;
                        }}
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer hover:bg-black/30 transition-all"
                         onClick={() => setIsPlaying(true)}>
                        <div className="bg-futuristic-yellow-500/90 hover:bg-futuristic-yellow-500 rounded-full p-4 shadow-glow-yellow transition-all hover:scale-110">
                            <svg className="w-16 h-16 text-black" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </div>
                    </div>
                </>
            ) : (
                <div className="absolute top-0 left-0 w-full h-full">
                    <iframe
                        className="w-full h-full rounded-lg border border-futuristic-blue-500/30"
                        src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        title={`${title} Trailer`}
                    ></iframe>
                    <button
                        onClick={() => setIsPlaying(false)}
                        className="absolute top-2 right-2 bg-futuristic-blue-900/90 hover:bg-futuristic-blue-800 text-white p-2 rounded-full transition-all"
                        aria-label="Close video"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default TrailerPlayer;

