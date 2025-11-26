"use client";
import { useEffect } from 'react';

export default function UnreleasedNotification({ isOpen, onClose, skippedItems }) {
    useEffect(() => {
        if (isOpen) {
            // Auto-close after 8 seconds
            const timer = setTimeout(() => {
                onClose();
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen || !skippedItems || skippedItems.length === 0) return null;

    const movies = skippedItems.filter(item => item.type === 'movie');
    const series = skippedItems.filter(item => item.type === 'series');
    const seasons = skippedItems.filter(item => item.type === 'season');
    const episodes = skippedItems.filter(item => item.type === 'episode');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="futuristic-card p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border-2 border-futuristic-yellow-500/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-futuristic-yellow-400 futuristic-text-glow-yellow flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Some Items Not Marked
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <p className="text-white mb-4">
                    The following items were not marked as watched because they haven't been released yet:
                </p>

                <div className="space-y-3">
                    {movies.length > 0 && (
                        <div>
                            <h4 className="text-futuristic-yellow-400 font-semibold mb-2">
                                Movies ({movies.length})
                            </h4>
                            <ul className="space-y-1">
                                {movies.map((item, index) => (
                                    <li key={index} className="text-white text-sm pl-4">
                                        • {item.name} (releases {item.releaseDate})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {series.length > 0 && (
                        <div>
                            <h4 className="text-futuristic-yellow-400 font-semibold mb-2">
                                Series ({series.length})
                            </h4>
                            <ul className="space-y-1">
                                {series.map((item, index) => (
                                    <li key={index} className="text-white text-sm pl-4">
                                        • {item.name} (releases {item.releaseDate})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {seasons.length > 0 && (
                        <div>
                            <h4 className="text-futuristic-yellow-400 font-semibold mb-2">
                                Seasons ({seasons.length})
                            </h4>
                            <ul className="space-y-1">
                                {seasons.map((item, index) => (
                                    <li key={index} className="text-white text-sm pl-4">
                                        • {item.seriesName} - {item.seasonName} (releases {item.releaseDate})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {episodes.length > 0 && (
                        <div>
                            <h4 className="text-futuristic-yellow-400 font-semibold mb-2">
                                Episodes ({episodes.length})
                            </h4>
                            <ul className="space-y-1">
                                {episodes.map((item, index) => (
                                    <li key={index} className="text-white text-sm pl-4">
                                        • {item.seriesName} - {item.seasonName} - {item.episodeName} (releases {item.releaseDate})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="mt-6 w-full futuristic-button-yellow"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}

