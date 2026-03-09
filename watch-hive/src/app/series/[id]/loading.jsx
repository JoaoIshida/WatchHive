import { SkeletonSection, SkeletonText } from '../../components/Skeleton';

export default function SeriesDetailLoading() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="flex flex-col sm:flex-row gap-6 mb-8">
                <div className="w-48 h-72 flex-shrink-0 rounded-lg animate-pulse bg-charcoal-800/60" />
                <div className="flex-1 space-y-4">
                    <div className="h-10 w-3/4 animate-pulse bg-charcoal-800/60 rounded" />
                    <SkeletonText lines={4} />
                    <div className="flex gap-2">
                        <div className="h-10 w-24 animate-pulse bg-charcoal-800/60 rounded" />
                        <div className="h-10 w-24 animate-pulse bg-charcoal-800/60 rounded" />
                    </div>
                </div>
            </div>
            <SkeletonSection title cards={6} />
        </div>
    );
}
