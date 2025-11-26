"use client";
import { useState } from 'react';

const WatchProviders = ({ providers, type = 'flatrate' }) => {
    const [showAll, setShowAll] = useState(false);
    const maxVisible = 6;
    const visibleProviders = showAll ? providers : providers.slice(0, maxVisible);
    const hasMore = providers.length > maxVisible;

    if (!providers || providers.length === 0) return null;

    const typeLabels = {
        flatrate: 'Available On',
        rent: 'Rent On',
        buy: 'Buy On',
    };

    const typeLabel = typeLabels[type] || 'Available On';

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-futuristic-yellow-400/90">{typeLabel}</p>
                {hasMore && (
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="text-xs text-futuristic-yellow-400/70 hover:text-futuristic-yellow-400 transition-colors"
                    >
                        {showAll ? 'Show Less' : `+${providers.length - maxVisible} more`}
                    </button>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                {visibleProviders.map((provider) => (
                    <div
                        key={provider.provider_id}
                        className="group relative flex items-center justify-center bg-futuristic-blue-800/60 hover:bg-futuristic-blue-700/80 border border-futuristic-yellow-500/30 hover:border-futuristic-yellow-400/60 rounded-lg p-2 transition-all hover:scale-105 hover:shadow-glow-yellow"
                        title={provider.provider_name}
                    >
                        {provider.logo_path ? (
                            <img
                                src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                alt={provider.provider_name}
                                className="w-10 h-10 object-contain"
                                loading="lazy"
                            />
                        ) : (
                            <span className="text-xs text-futuristic-yellow-400 font-medium px-2 py-1">
                                {provider.provider_name}
                            </span>
                        )}
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-futuristic-blue-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-futuristic-yellow-500/50">
                            {provider.provider_name}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WatchProviders;

