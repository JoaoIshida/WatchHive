"use client";
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function UnreleasedNotification({ isOpen, onClose, skippedItems, summary }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            // Auto-close after 8 seconds
            const timer = setTimeout(() => {
                onClose();
            }, 8000);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
            return () => {
                clearTimeout(timer);
                document.body.style.overflow = 'unset';
            };
        }
    }, [isOpen, onClose]);

    if (!mounted || !isOpen) return null;
    
    // Show notification if there are skipped items OR if there's a summary to show
    if ((!skippedItems || skippedItems.length === 0) && !summary) return null;

    const movies = skippedItems?.filter(item => item.type === 'movie') || [];
    const series = skippedItems?.filter(item => item.type === 'series') || [];
    const seasons = skippedItems?.filter(item => item.type === 'season') || [];
    const episodes = skippedItems?.filter(item => item.type === 'episode') || [];

    const modalContent = (
        <div 
            className="fixed inset-0"
            style={{ 
                zIndex: 99999,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                isolation: 'isolate'
            }}
        >
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
                style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1
                }}
            />
            
            {/* Modal Container */}
            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none" style={{ zIndex: 2 }}>
                {/* Modal */}
                <div 
                    className="futuristic-card p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border-2 border-amber-500/50 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
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

                    {summary && (
                        <div className="bg-charcoal-800/50 border border-amber-500/30 rounded-lg p-3 mb-4">
                            <p className="text-amber-500 font-semibold text-sm">
                                {summary.markedSeasons > 0 && `${summary.markedSeasons} season${summary.markedSeasons !== 1 ? 's' : ''} marked`}
                                {summary.markedSeasons > 0 && summary.markedEpisodes > 0 && ' • '}
                                {summary.markedEpisodes > 0 && `${summary.markedEpisodes} episode${summary.markedEpisodes !== 1 ? 's' : ''} marked`}
                                {summary.markedSeasons > 0 && skippedItems?.length > 0 && ' • '}
                                {skippedItems?.length > 0 && `${skippedItems.length} item${skippedItems.length !== 1 ? 's' : ''} skipped`}
                            </p>
                        </div>
                    )}
                    <p className="text-white mb-4">
                        {skippedItems?.length > 0 
                            ? "The following items were not marked as watched because they haven't been released yet:"
                            : "All available content has been marked as watched."
                        }
                    </p>

                    <div className="space-y-3">
                        {movies.length > 0 && (
                            <div>
                                <h4 className="text-amber-500 font-semibold mb-2">
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
                                <h4 className="text-amber-500 font-semibold mb-2">
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
                                <h4 className="text-amber-500 font-semibold mb-2">
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
                                <h4 className="text-amber-500 font-semibold mb-2">
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
        </div>
    );

    return createPortal(modalContent, document.body);
}
