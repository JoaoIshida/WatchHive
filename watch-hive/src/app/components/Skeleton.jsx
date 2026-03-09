"use client";

const shimmerClass = "animate-pulse bg-charcoal-800/60 rounded";

export function SkeletonCard({ className = "" }) {
    return (
        <div className={`futuristic-card p-6 ${className}`}>
            <div className={`h-10 w-10 rounded ${shimmerClass} mb-2 mx-auto`} />
            <div className={`h-8 w-16 ${shimmerClass} mb-2 mx-auto`} />
            <div className={`h-4 w-24 ${shimmerClass} mx-auto mb-2`} />
            <div className={`h-3 w-full ${shimmerClass}`} />
        </div>
    );
}

export function SkeletonText({ lines = 1, className = "" }) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className={`h-4 ${shimmerClass} ${i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"}`}
                />
            ))}
        </div>
    );
}

export function SkeletonListRow({ className = "" }) {
    return (
        <div className={`flex items-center gap-3 p-3 ${className}`}>
            <div className={`h-10 w-10 rounded-full ${shimmerClass} flex-shrink-0`} />
            <div className={`h-4 flex-1 max-w-[200px] ${shimmerClass}`} />
            <div className={`h-8 w-20 ${shimmerClass}`} />
        </div>
    );
}

export function SkeletonSection({ title = true, cards = 4, className = "" }) {
    return (
        <div className={`space-y-4 ${className}`}>
            {title && (
                <div className={`h-6 w-40 ${shimmerClass}`} />
            )}
            <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: cards }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>
        </div>
    );
}

/**
 * Profile page skeleton while initial data is loading.
 */
export function ProfilePageSkeleton() {
    return (
        <div className="page-container max-w-7xl">
            <div className="flex items-center justify-between mb-6">
                <div className={`h-9 w-48 ${shimmerClass}`} />
                <div className={`h-10 w-24 ${shimmerClass}`} />
            </div>
            <div className="flex flex-wrap gap-2 mb-6 border-b border-charcoal-700/30 pb-2">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className={`h-9 w-24 ${shimmerClass}`} />
                ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>
            <div className={`futuristic-card p-6 h-48 ${shimmerClass}`} />
        </div>
    );
}

/**
 * Recommendations results skeleton.
 */
export function RecommendationsSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="futuristic-card overflow-hidden animate-pulse">
                    <div className="aspect-[2/3] bg-charcoal-800/60 rounded-t" />
                    <div className="p-2 space-y-2">
                        <div className={`h-3 w-full ${shimmerClass}`} />
                        <div className={`h-2 w-2/3 ${shimmerClass}`} />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Series/list loading skeleton (horizontal scroll of cards).
 */
export function SeriesListSkeleton({ count = 6 }) {
    return (
        <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[140px]">
                    <div className="futuristic-card overflow-hidden animate-pulse">
                        <div className="aspect-[2/3] bg-charcoal-800/60" />
                        <div className="p-2 space-y-2">
                            <div className={`h-3 w-full ${shimmerClass}`} />
                            <div className={`h-2 w-2/3 ${shimmerClass}`} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default { SkeletonCard, SkeletonText, SkeletonListRow, SkeletonSection, ProfilePageSkeleton, RecommendationsSkeleton, SeriesListSkeleton };
