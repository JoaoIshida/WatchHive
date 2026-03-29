"use client";
import { Bookmark } from 'lucide-react';
import ContentCard from '../components/ContentCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ProfileFavoritesSection({ loadingFavoritesDetails, favoritesDetails }) {
    if (loadingFavoritesDetails) {
        return (
            <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading favorites..." />
            </div>
        );
    }
    if (favoritesDetails.length === 0) {
        return (
            <div className="text-center py-12 futuristic-card">
                <Bookmark className="w-12 h-12 mx-auto text-amber-500/50 mb-3" aria-hidden />
                <p className="text-xl text-white mb-2">No favorites yet</p>
                <p className="text-amber-500/80">Tap the heart on a title to save favorites here.</p>
            </div>
        );
    }
    return (
        <>
            <div className="mb-4 text-sm text-amber-500/80">
                Showing {favoritesDetails.length} {favoritesDetails.length === 1 ? 'item' : 'items'}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {favoritesDetails
                    .sort((a, b) => {
                        const dateA = new Date(a.dateAdded || 0);
                        const dateB = new Date(b.dateAdded || 0);
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
                                {item.dateAdded && (
                                    <div className="absolute bottom-2 right-2 bg-charcoal-800/90 text-white text-[8px] px-1.5 py-0.5 rounded z-20">
                                        Added {new Date(item.dateAdded).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        );
                    })}
            </div>
        </>
    );
}
