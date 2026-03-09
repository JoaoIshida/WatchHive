"use client";
import ContentCard from '../components/ContentCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ProfileWishlistSection({ loadingWishlistDetails, wishlistDetails }) {
    if (loadingWishlistDetails) {
        return (
            <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading wishlist content..." />
            </div>
        );
    }
    if (wishlistDetails.length === 0) {
        return (
            <div className="text-center py-12 futuristic-card">
                <p className="text-xl text-white mb-2">Your wishlist is empty</p>
                <p className="text-amber-500/80">Add movies and series to your wishlist to see them here!</p>
            </div>
        );
    }
    return (
        <>
            <div className="mb-4 text-sm text-amber-500/80">
                Showing {wishlistDetails.length} {wishlistDetails.length === 1 ? 'item' : 'items'} in wishlist
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {wishlistDetails
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
