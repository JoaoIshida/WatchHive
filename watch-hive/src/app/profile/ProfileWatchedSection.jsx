"use client";
import ContentCard from '../components/ContentCard';

export default function ProfileWatchedSection({ watchedDetails, watchedFilter, setWatchedFilter }) {
    return (
        <div>
            {watchedDetails.length === 0 ? (
                <div className="text-center py-12 futuristic-card">
                    <p className="text-xl text-white mb-2">No watched items yet</p>
                    <p className="text-amber-500/80">Start watching and mark items as watched to see them here!</p>
                </div>
            ) : (
                <>
                    {/* Filter Buttons */}
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-sm text-white/70">Filter:</span>
                        <button
                            onClick={() => setWatchedFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                watchedFilter === 'all'
                                    ? 'bg-amber-500 text-black'
                                    : 'bg-charcoal-800 text-white hover:bg-charcoal-700'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setWatchedFilter('movie')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                watchedFilter === 'movie'
                                    ? 'bg-amber-500 text-black'
                                    : 'bg-charcoal-800 text-white hover:bg-charcoal-700'
                            }`}
                        >
                            Movies
                        </button>
                        <button
                            onClick={() => setWatchedFilter('tv')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                watchedFilter === 'tv'
                                    ? 'bg-amber-500 text-black'
                                    : 'bg-charcoal-800 text-white hover:bg-charcoal-700'
                            }`}
                        >
                            Series
                        </button>
                    </div>

                    {/* Filtered Items */}
                    {(() => {
                        const filteredItems = watchedDetails.filter(item => {
                            if (watchedFilter === 'all') return true;
                            if (watchedFilter === 'movie') return item.media_type === 'movie';
                            if (watchedFilter === 'tv') return item.media_type === 'tv';
                            return true;
                        });

                        if (filteredItems.length === 0) {
                            return (
                                <div className="text-center py-12 futuristic-card">
                                    <p className="text-xl text-white mb-2">No {watchedFilter === 'movie' ? 'movies' : watchedFilter === 'tv' ? 'series' : 'items'} watched yet</p>
                                    <p className="text-amber-500/80">Start watching {watchedFilter === 'movie' ? 'movies' : watchedFilter === 'tv' ? 'series' : 'content'} to see them here!</p>
                                </div>
                            );
                        }

                        return (
                            <>
                                <div className="mb-4 text-sm text-amber-500/80">
                                    Showing {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                                    {watchedFilter !== 'all' && (
                                        <span> ({watchedDetails.length} total)</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {filteredItems
                                        .sort((a, b) => {
                                            const dateA = new Date(a.dateWatched || 0);
                                            const dateB = new Date(b.dateWatched || 0);
                                            return dateB - dateA;
                                        })
                                        .map((item) => {
                                            const href = item.media_type === 'movie'
                                                ? `/movies/${item.id}`
                                                : `/series/${item.id}`;

                                            return (
                                                <div key={`${item.media_type}-${item.id}`} className="relative">
                                                    <ContentCard
                                                        item={item}
                                                        mediaType={item.media_type}
                                                        href={href}
                                                    />
                                                    <div className="absolute top-2 right-2 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded z-20">
                                                        {item.timesWatched}x
                                                    </div>
                                                    {item.dateWatched && (
                                                        <div className="absolute bottom-2 right-2 bg-charcoal-800/90 text-white text-[8px] px-1.5 py-0.5 rounded z-20">
                                                            {new Date(item.dateWatched).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </>
                        );
                    })()}
                </>
            )}
        </div>
    );
}
