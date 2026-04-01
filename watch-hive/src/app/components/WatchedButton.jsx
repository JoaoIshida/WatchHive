"use client";
import { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import { isMovieReleased, isSeriesReleased } from '../utils/releaseDateValidator';
import { formatDate } from '../utils/dateFormatter';
import UnreleasedNotification from './UnreleasedNotification';
import ReminderPickerModal from './ReminderPickerModal';

export default function WatchedButton({ itemId, mediaType, onUpdate, seasons = null, itemData = null }) {
    const { user } = useAuth();
    const { watched, seriesProgress, refreshUserData } = useUserData();
    const [loading, setLoading] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [skippedItems, setSkippedItems] = useState([]);
    const [error, setError] = useState(null);
    const [seriesSummary, setSeriesSummary] = useState(null);
    const [reminderOpen, setReminderOpen] = useState(false);

    const shouldShowWatchingReminder = () => {
        if (typeof window === 'undefined') return false;
        // Respect per-flow suppression
        const suppressed = window.localStorage.getItem('watchhive_suppress_watching_reminder_picker') === '1';
        if (suppressed) return false;
        if (mediaType !== 'tv' || !itemData) return false;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // If TMDB says the series is still in production / returning, there may be future episodes
        const status = (itemData.status || '').toLowerCase();
        if (['returning series', 'in production', 'planned', 'pilot'].includes(status)) {
            return true;
        }

        // If TMDB exposes a next_episode_to_air in the future, definitely show
        const nextAir = itemData.next_episode_to_air?.air_date;
        if (nextAir) {
            const nextDate = new Date(nextAir);
            nextDate.setHours(0, 0, 0, 0);
            if (nextDate >= now) return true;
        }

        // If last_air_date is in the future, there may still be unaired content
        if (itemData.last_air_date) {
            const lastDate = new Date(itemData.last_air_date);
            lastDate.setHours(0, 0, 0, 0);
            if (lastDate >= now) return true;
        }

        return false;
    };

    // Derive watched state from context
    const watchedItem = user
        ? watched.find(w => w.content_id === itemId && w.media_type === mediaType)
        : null;
    const isWatched = !!watchedItem;
    const timesWatched = watchedItem?.times_watched || 0;

    const handleToggle = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        setError(null);

        if (isWatched) {
            setLoading(true);
            
            try {
                const response = await fetch(`/api/watched?itemId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                
                if (!response.ok) {
                    setError('Failed to remove from watched. Please try again.');
                }
                refreshUserData();
                if (mediaType === 'tv') {
                    window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
                }
            } catch (error) {
                console.error('Error removing watched status:', error);
                setError('Failed to remove from watched. Please try again.');
            } finally {
                setLoading(false);
            }
        } else {
            // Check if item is released before marking as watched
            if (mediaType === 'movie') {
                if (itemData && !isMovieReleased(itemData)) {
                    setSkippedItems([{
                        type: 'movie',
                        name: itemData.title,
                        releaseDate: formatDate(itemData.release_date)
                    }]);
                    setShowNotification(true);
                    return;
                }
            } else if (mediaType === 'tv') {
                if (itemData && !isSeriesReleased(itemData)) {
                    setSkippedItems([{
                        type: 'series',
                        name: itemData.name,
                        releaseDate: formatDate(itemData.first_air_date)
                    }]);
                    setShowNotification(true);
                    return;
                }
            }

            setLoading(true);
            try {
                const response = await fetch('/api/watched', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId, mediaType }),
                });
                
                if (response.ok) {
                    const data = await response.json();
                    let openedReminder = false;

                    if (mediaType === 'tv' && data.seriesProgress) {
                        const skipped = [];
                        
                        if (data.seriesProgress.skippedSeasons?.length) {
                            data.seriesProgress.skippedSeasons.forEach(season => {
                                skipped.push({
                                    type: 'season',
                                    seriesName: itemData?.name || 'Series',
                                    seasonName: season.seasonName || `Season ${season.seasonNumber}`,
                                    releaseDate: formatDate(season.releaseDate)
                                });
                            });
                        }
                        
                        if (data.seriesProgress.skippedEpisodes?.length) {
                            data.seriesProgress.skippedEpisodes.forEach(ep => {
                                skipped.push({
                                    type: 'episode',
                                    seriesName: itemData?.name || 'Series',
                                    seasonName: ep.seasonName || `Season ${ep.seasonNumber}`,
                                    episodeName: ep.episodeName || `Episode ${ep.episodeNumber}`,
                                    releaseDate: formatDate(ep.releaseDate)
                                });
                            });
                        }
                        
                        if (skipped.length > 0) {
                            setSkippedItems(skipped);
                            setSeriesSummary({
                                markedSeasons: data.seriesProgress.markedSeasons || 0,
                                markedEpisodes: data.seriesProgress.markedEpisodes || 0
                            });
                            setShowNotification(true);
                        } else {
                            if (shouldShowWatchingReminder()) {
                                setReminderOpen(true);
                            }
                            openedReminder = true;
                        }
                    }
                    if (mediaType === 'tv' && !openedReminder && !data.seriesProgress) {
                        if (shouldShowWatchingReminder()) {
                            setReminderOpen(true);
                        }
                    }
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    setError(errorData.error || 'Failed to mark as watched. Please try again.');
                }
                refreshUserData();
                if (mediaType === 'tv') {
                    window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
                }
            } catch (error) {
                console.error('Error toggling watched status:', error);
                setError('An error occurred. Please try again.');
            } finally {
                setLoading(false);
            }
        }
        
        if (onUpdate) onUpdate();
    };

    const handleIncrement = async () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/watched', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, mediaType }),
            });
            if (response.ok) {
                refreshUserData();
                if (mediaType === 'tv') {
                    window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
                }
            }
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error incrementing watched count:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <ReminderPickerModal
                open={reminderOpen}
                onClose={() => setReminderOpen(false)}
                contentId={itemId}
                mediaType="tv"
                variant="watching"
                title="Episode / air-date reminder"
                flowKey="watching"
            />
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleToggle}
                        disabled={loading}
                        className={`futuristic-button flex items-center gap-2 ${
                            isWatched 
                                ? 'bg-amber-500 hover:bg-amber-400 text-black' 
                                : ''
                        } ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Processing...</span>
                            </>
                        ) : isWatched ? (
                            <>
                                <span>✓</span>
                                <span>Watched</span>
                            </>
                        ) : (
                            <>
                                <span>+</span>
                                <span>Mark as Watched</span>
                            </>
                        )}
                    </button>
                    {isWatched && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-charcoal-900/80 border border-amber-500/40">
                            <Eye className="w-4 h-4 text-amber-400" />
                            <div className="flex items-center gap-1 ml-1">
                                <button
                                    onClick={() => {
                                        if (!loading) {
                                            void handleToggle();
                                        }
                                    }}
                                    disabled={loading}
                                    className="w-6 h-6 flex items-center justify-center rounded-full border border-charcoal-700 bg-charcoal-900 text-white/80 hover:bg-charcoal-800 hover:border-amber-500/60 disabled:opacity-40 disabled:cursor-not-allowed text-[11px]"
                                    aria-label="Decrease watched count"
                                >
                                    –
                                </button>
                                <span className="min-w-[1.75rem] text-center text-xs font-semibold text-amber-400 tabular-nums">
                                    {timesWatched}x
                                </span>
                                <button
                                    onClick={() => {
                                        if (!loading) {
                                            void handleIncrement();
                                        }
                                    }}
                                    disabled={loading}
                                    className="w-6 h-6 flex items-center justify-center rounded-full border border-amber-500/70 bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-[11px]"
                                    aria-label="Increase watched count"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                {error && (
                    <div className="text-red-400 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="ml-auto text-white/70 hover:text-white"
                        >
                            ×
                        </button>
                    </div>
                )}
            </div>
            <UnreleasedNotification
                isOpen={showNotification}
                onClose={() => {
                    setShowNotification(false);
                    setSeriesSummary(null);
                }}
                skippedItems={skippedItems}
                summary={seriesSummary}
            />
        </>
    );
}
