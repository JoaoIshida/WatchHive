"use client";

export default function LoadingCard({ count = 1 }) {
    return (
        <>
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="futuristic-card overflow-hidden animate-pulse">
                    <div className="relative aspect-[2/3] overflow-hidden bg-futuristic-blue-900 loading-shimmer">
                        <div className="w-full h-full bg-gradient-to-br from-futuristic-blue-800 to-futuristic-blue-900"></div>
                    </div>
                    <div className="p-2 bg-futuristic-blue-900/80">
                        <div className="h-3 bg-futuristic-blue-700/50 rounded mb-1.5 loading-shimmer"></div>
                        <div className="h-2 bg-futuristic-blue-700/30 rounded w-2/3 loading-shimmer"></div>
                    </div>
                </div>
            ))}
        </>
    );
}

