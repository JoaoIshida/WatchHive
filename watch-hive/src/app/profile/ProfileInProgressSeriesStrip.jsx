"use client";
import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import ImageWithFallback from '../components/ImageWithFallback';
import HorizontalScrollArea from '../components/HorizontalScrollArea';
import { useReleasedGapProgressBatch } from '../hooks/useReleasedGapProgressBatch';

export default function ProfileInProgressSeriesStrip({ seriesProgress, seriesDetails }) {
    const candidates = useMemo(() => {
        return Object.entries(seriesProgress)
            .map(([seriesId, progress]) => {
                const seriesInfo = seriesDetails[seriesId];
                const seasons =
                    seriesInfo?.seasons?.filter((s) => s.season_number > 0) || [];
                if (seasons.length === 0) {
                    return null;
                }
                return {
                    seriesId,
                    lastWatched: progress.lastWatched ?? progress.last_watched ?? null,
                    name: seriesDetails[seriesId]?.name,
                    posterPath: seriesDetails[seriesId]?.poster_path,
                };
            })
            .filter(Boolean);
    }, [seriesProgress, seriesDetails]);

    const candidateIds = useMemo(
        () => candidates.map((c) => c.seriesId),
        [candidates],
    );
    const progressById = useReleasedGapProgressBatch(candidateIds);

    const inProgressSeries = useMemo(() => {
        const rows = candidates
            .map((row) => {
                const released = progressById[row.seriesId];
                if (!released?.ready) {
                    return { ...row, loading: true, percentage: null };
                }
                if (released.error || (released.percentage ?? 0) >= 100) {
                    return null;
                }
                return { ...row, loading: false, percentage: released.percentage };
            })
            .filter(Boolean);

        return rows.sort((a, b) => {
            if (a.loading !== b.loading) return a.loading ? 1 : -1;
            const ta = a.lastWatched ? new Date(a.lastWatched).getTime() : 0;
            const tb = b.lastWatched ? new Date(b.lastWatched).getTime() : 0;
            if (tb !== ta) return tb - ta;
            return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
                sensitivity: 'base',
            });
        });
    }, [candidates, progressById]);

    if (candidates.length === 0) {
        return null;
    }

    const anyStillLoading = candidates.some((c) => !progressById[c.seriesId]?.ready);
    if (inProgressSeries.length === 0 && !anyStillLoading) {
        return null;
    }

    return (
        <section className="space-y-2" aria-label="Series in progress">
            <div className="flex items-center justify-start gap-2">
                <h2 className="text-sm font-bold text-amber-500">Series in progress</h2>
                <Link
                    href="/profile/series"
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-500/80 hover:text-amber-400 transition-colors"
                >
                    View all
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                </Link>
            </div>

            <HorizontalScrollArea
                className="-mx-1 px-1"
                contentClassName="!gap-3"
                ariaLabel="Scroll series in progress horizontally"
            >
                {inProgressSeries.map(({ seriesId, name, posterPath, percentage, loading }) => (
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
                                {loading ? (
                                    <>
                                        <div className="mt-1.5 h-1 rounded-full bg-charcoal-700/90 overflow-hidden animate-pulse" />
                                        <p className="text-[10px] text-amber-500/60 mt-0.5 font-medium">
                                            Loading…
                                        </p>
                                    </>
                                ) : (
                                    <>
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
                                    </>
                                )}
                            </div>
                        </div>
                    </Link>
                ))}
            </HorizontalScrollArea>
        </section>
    );
}
