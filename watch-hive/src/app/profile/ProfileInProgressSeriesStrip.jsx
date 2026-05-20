"use client";
import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import ImageWithFallback from '../components/ImageWithFallback';
import HorizontalScrollArea from '../components/HorizontalScrollArea';
import {
    calculateSeriesProgress,
    isSeriesCompletedByEpisodes,
} from '../utils/seriesProgressCalculator';

export default function ProfileInProgressSeriesStrip({ seriesProgress, seriesDetails }) {
    const inProgressSeries = useMemo(() => {
        return Object.entries(seriesProgress)
            .map(([seriesId, progress]) => {
                const seasons = seriesDetails[seriesId]?.seasons || [];
                const completedByEpisodes = isSeriesCompletedByEpisodes(
                    progress,
                    seasons,
                    {},
                );
                const { percentage } = calculateSeriesProgress(progress, seasons, {});
                return {
                    seriesId,
                    completedByEpisodes,
                    percentage,
                    lastWatched: progress.lastWatched ?? progress.last_watched ?? null,
                    name: seriesDetails[seriesId]?.name,
                    posterPath: seriesDetails[seriesId]?.poster_path,
                };
            })
            .filter((row) => !row.completedByEpisodes && row.percentage < 100)
            .sort((a, b) => {
                const ta = a.lastWatched ? new Date(a.lastWatched).getTime() : 0;
                const tb = b.lastWatched ? new Date(b.lastWatched).getTime() : 0;
                if (tb !== ta) return tb - ta;
                return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
                    sensitivity: 'base',
                });
            });
    }, [seriesProgress, seriesDetails]);

    if (inProgressSeries.length === 0) {
        return null;
    }

    return (
        <section className="space-y-2" aria-label="Series in progress">
            <div className="flex justify-end">
                <Link
                    href="/profile/series"
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors"
                >
                    Series progress
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                </Link>
            </div>

            <HorizontalScrollArea
                className="-mx-1 px-1"
                contentClassName="!gap-3"
                ariaLabel="Scroll series in progress horizontally"
            >
                    {inProgressSeries.map(({ seriesId, name, posterPath, percentage }) => (
                        <Link
                            key={seriesId}
                            href={`/series/${seriesId}`}
                            className="group flex-shrink-0 w-36 sm:w-40 rounded-lg overflow-hidden border border-charcoal-700/80 bg-charcoal-900/80 hover:border-amber-500/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                        >
                            <div className="relative aspect-[16/10] bg-charcoal-800">
                                <ImageWithFallback
                                    src={
                                        posterPath
                                            ? `https://image.tmdb.org/t/p/w500${posterPath}`
                                            : null
                                    }
                                    alt={name || 'Series'}
                                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950 via-charcoal-950/40 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-2">
                                    <p className="text-white font-semibold text-xs line-clamp-2 leading-snug">
                                        {name || (
                                            <span className="text-amber-500/60 animate-pulse">
                                                Loading…
                                            </span>
                                        )}
                                    </p>
                                    <div className="mt-1.5 h-1 rounded-full bg-charcoal-700/90 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-amber-500 transition-all"
                                            style={{
                                                width: `${Math.min(100, Math.max(0, percentage))}%`,
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-amber-500/90 mt-0.5 font-medium">
                                        {percentage}% watched
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
            </HorizontalScrollArea>
        </section>
    );
}
