export default function WishlistLoading() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 py-6" aria-busy="true" aria-label="Loading wishlist">
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={i}
                    className="aspect-[2/3] rounded-lg bg-charcoal-800/70 animate-pulse border border-charcoal-700/30"
                />
            ))}
        </div>
    );
}
