"use client";
import { useMemo, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';
import { buildSeriesTvReleaseMeta, isEpisodeReleasedOrdered } from '../utils/releaseDateValidator';
import { calculateSeasonProgress } from '../utils/seriesProgressCalculator';
import { useReleasedGapProgressBatch } from '../hooks/useReleasedGapProgressBatch';
import Pagination from '../components/Pagination';
import { parsePageParam, parseSortParam, useReplaceQuery } from './useReplaceQuery';

const SERIES_PAGE_SIZE = 10;
const SERIES_SORTS = [
    'date-desc',
    'date-asc',
    'name-asc',
    'name-desc',
    'progress-desc',
];

function lastWatchedTime(progress) {
    const raw = progress?.lastWatched ?? progress?.last_watched ?? null;
    const t = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
}

export default function ProfileSeriesSection({
    seriesProgress,
    seriesDetails,
    expandedSeries,
    setExpandedSeries,
    seriesSeasonDetails,
    setSeriesSeasonDetails,
}) {
    const { replaceParams, searchParams } = useReplaceQuery();
    const page = useMemo(() => parsePageParam(searchParams, 'page'), [searchParams]);
    const sortMode = useMemo(
        () => parseSortParam(searchParams, SERIES_SORTS, 'date-desc'),
        [searchParams],
    );

    const seriesIdsKey = useMemo(() => Object.keys(seriesProgress).sort().join(','), [seriesProgress]);
    const prevSeriesIdsKeyRef = useRef(null);
    useEffect(() => {
        if (prevSeriesIdsKeyRef.current === null) {
            prevSeriesIdsKeyRef.current = seriesIdsKey;
            return;
        }
        if (prevSeriesIdsKeyRef.current !== seriesIdsKey) {
            prevSeriesIdsKeyRef.current = seriesIdsKey;
            replaceParams((next) => next.delete('page'));
        }
    }, [seriesIdsKey, replaceParams]);

    const isProgressSort = sortMode === 'progress-desc';

    const allSeriesIds = useMemo(
        () => Object.keys(seriesProgress),
        [seriesProgress],
    );
    /** Progress sort needs % for every series; date/name only fetch the current page (10). */
    const releasedProgressForSort = useReleasedGapProgressBatch(
        isProgressSort ? allSeriesIds : [],
    );

    const sortedEntries = useMemo(() => {
        const tie = (idA, idB) => String(idA).localeCompare(String(idB));
        const progressPercent = (seriesId) => {
            const r = releasedProgressForSort[seriesId];
            if (r?.ready && !r.error) return r.percentage ?? 0;
            return -1;
        };

        return Object.entries(seriesProgress).sort(([idA, progA], [idB, progB]) => {
            const nameA = seriesDetails[idA]?.name || '';
            const nameB = seriesDetails[idB]?.name || '';

            if (sortMode === 'name-asc') {
                const c = String(nameA).localeCompare(String(nameB), undefined, { sensitivity: 'base' });
                return c !== 0 ? c : tie(idA, idB);
            }
            if (sortMode === 'name-desc') {
                const c = String(nameB).localeCompare(String(nameA), undefined, { sensitivity: 'base' });
                return c !== 0 ? c : tie(idA, idB);
            }

            if (sortMode === 'progress-desc') {
                const pA = progressPercent(idA);
                const pB = progressPercent(idB);
                if (pA !== pB) return pB - pA;
                const c = String(nameA).localeCompare(String(nameB), undefined, { sensitivity: 'base' });
                return c !== 0 ? c : tie(idA, idB);
            }

            const dateA = lastWatchedTime(progA);
            const dateB = lastWatchedTime(progB);
            if (sortMode === 'date-asc') {
                if (dateA !== dateB) return dateA - dateB;
                const c = String(nameA).localeCompare(String(nameB), undefined, { sensitivity: 'base' });
                return c !== 0 ? c : tie(idA, idB);
            }
            if (dateB !== dateA) return dateB - dateA;
            const c = String(nameA).localeCompare(String(nameB), undefined, { sensitivity: 'base' });
            return c !== 0 ? c : tie(idA, idB);
        });
    }, [seriesProgress, seriesDetails, sortMode, releasedProgressForSort]);

    const totalPages = Math.max(1, Math.ceil(sortedEntries.length / SERIES_PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageEntries = sortedEntries.slice((safePage - 1) * SERIES_PAGE_SIZE, safePage * SERIES_PAGE_SIZE);

    const pageSeriesIds = useMemo(
        () => pageEntries.map(([seriesId]) => seriesId),
        [pageEntries],
    );
    const releasedProgressForPage = useReleasedGapProgressBatch(
        isProgressSort ? [] : pageSeriesIds,
    );
    const releasedProgressById = useMemo(
        () =>
            isProgressSort
                ? releasedProgressForSort
                : releasedProgressForPage,
        [isProgressSort, releasedProgressForSort, releasedProgressForPage],
    );

    // Only snap an out-of-range page back once the list has loaded: on refresh or Back the list is
    // empty for a moment, and "page 3 of 1" used to rewrite the URL to page 1.
    useEffect(() => {
        if (sortedEntries.length > 0 && page > totalPages) {
            replaceParams((next) => {
                if (totalPages <= 1) next.delete('page');
                else next.set('page', String(totalPages));
            });
        }
    }, [sortedEntries.length, totalPages, page, replaceParams]);

    const setPageInUrl = (newPage) =>
        replaceParams((next) => {
            if (newPage <= 1) next.delete('page');
            else next.set('page', String(newPage));
        });

    const setSortInUrl = (nextSort) =>
        replaceParams((next) => {
            next.delete('page');
            if (nextSort === 'date-desc') next.delete('sort');
            else next.set('sort', nextSort);
        });

    if (Object.keys(seriesProgress).length === 0) {
        return (
            <div>
                <div className="text-center py-12 futuristic-card">
                    <p className="text-xl text-white mb-2">No series in progress</p>
                    <p className="text-amber-500/80">Start watching a series and track your progress!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="text-sm text-amber-500/80">
                    {sortedEntries.length > SERIES_PAGE_SIZE
                        ? `Showing ${(safePage - 1) * SERIES_PAGE_SIZE + 1}–${(safePage - 1) * SERIES_PAGE_SIZE + pageEntries.length} of ${sortedEntries.length} series`
                        : `${sortedEntries.length} ${sortedEntries.length === 1 ? 'series' : 'series'}`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-white/70">Sort:</span>
                    <select
                        value={sortMode}
                        onChange={(e) => setSortInUrl(e.target.value)}
                        className="rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm font-semibold text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        aria-label="Sort series list"
                    >
                        <option value="date-desc">Last watched (newest)</option>
                        <option value="date-asc">Last watched (oldest)</option>
                        <option value="name-asc">Title A–Z</option>
                        <option value="name-desc">Title Z–A</option>
                        <option value="progress-desc">Progress (high → low)</option>
                    </select>
                </div>
            </div>
            {pageEntries.map(([seriesId, progress]) => {
                const seriesInfo = seriesDetails[seriesId];
                const seriesTvMeta = buildSeriesTvReleaseMeta(seriesInfo);
                const isExpanded = expandedSeries[seriesId];

                const totalSeasonsFromTMDB = seriesInfo?.seasons?.filter(s => s.season_number > 0).length || 0;
                const watchedSeasonsCount = Object.keys(progress.seasons || {}).filter(seasonNum => parseInt(seasonNum) > 0).length;
                const totalSeasons = totalSeasonsFromTMDB > 0 ? totalSeasonsFromTMDB : watchedSeasonsCount;
                const specialsCount = seriesInfo?.seasons?.filter(s => s.season_number === 0).length || 0;
                const watchedSpecialsCount = Object.keys(progress.seasons || {}).filter(seasonNum => parseInt(seasonNum) === 0).length;
                const completedSeasons = Object.values(progress.seasons || {}).filter(season => season.completed).length;
                const totalEpisodesWatched = Object.entries(progress.seasons || {})
                    .filter(([seasonNum]) => parseInt(seasonNum) > 0)
                    .reduce((total, [, season]) => total + (season.episodes?.length || 0), 0);

                const releasedOverall = releasedProgressById[seriesId];
                const overallPercentLoading = releasedOverall?.ready !== true;
                const overallPercentage =
                    releasedOverall?.ready && !releasedOverall.error
                        ? releasedOverall.percentage
                        : null;
                const overallTotal =
                    releasedOverall?.ready && !releasedOverall.error
                        ? releasedOverall.total
                        : 0;

                const toggleSeries = async () => {
                    if (isExpanded) {
                        setExpandedSeries(prev => ({ ...prev, [seriesId]: false }));
                    } else {
                        setExpandedSeries(prev => ({ ...prev, [seriesId]: true }));
                        if (seriesInfo?.seasons) {
                            const seasonPromises = Object.keys(progress.seasons || {}).map(async (seasonNum) => {
                                try {
                                    const response = await fetch(`/api/tv/${seriesId}/season/${seasonNum}`);
                                    if (response.ok) {
                                        const data = await response.json();
                                        return { seasonNumber: parseInt(seasonNum), data };
                                    }
                                } catch (error) {
                                    console.error(`Error fetching season ${seasonNum} for series ${seriesId}:`, error);
                                }
                                return null;
                            });
                            const results = await Promise.all(seasonPromises);
                            const seasonDetailsMap = {};
                            results.forEach(result => {
                                if (result) {
                                    if (!seasonDetailsMap[seriesId]) {
                                        seasonDetailsMap[seriesId] = {};
                                    }
                                    seasonDetailsMap[seriesId][result.seasonNumber] = result.data;
                                }
                            });
                            setSeriesSeasonDetails(prev => ({
                                ...prev,
                                ...seasonDetailsMap
                            }));
                        }
                    }
                };

                const getSeasonProgress = (seasonNumber) => {
                    const seasonData = seriesSeasonDetails[seriesId]?.[seasonNumber];
                    return calculateSeasonProgress(
                        parseInt(seasonNumber, 10),
                        progress,
                        seasonData,
                        seriesInfo?.seasons,
                        seriesTvMeta,
                        null,
                    );
                };

                return (
                    <div key={seriesId} className="futuristic-card p-6">
                        <div
                            className="flex items-center justify-between mb-4 cursor-pointer"
                            onClick={toggleSeries}
                        >
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-white">
                                    <a
                                        href={`/series/${seriesId}`}
                                        className="hover:text-amber-500 transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {seriesInfo?.name || (
                                            <span className="text-amber-500/60 animate-pulse">Loading series name...</span>
                                        )}
                                    </a>
                                </h3>
                                <p className="text-sm text-amber-500/80 mt-2">
                                    {watchedSeasonsCount}/{totalSeasons} seasons watched • {completedSeasons} completed • {totalEpisodesWatched} episodes watched
                                    {specialsCount > 0 && (
                                        <span className="ml-2">• {watchedSpecialsCount}/{specialsCount} specials</span>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                {overallPercentLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 bg-charcoal-800 rounded-full h-2 animate-pulse" />
                                        <span className="text-sm text-amber-500/60 tabular-nums">
                                            …
                                        </span>
                                    </div>
                                ) : (
                                    overallTotal > 0 && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 bg-charcoal-800 rounded-full h-2">
                                                <div
                                                    className="bg-amber-500 h-2 rounded-full transition-all"
                                                    style={{
                                                        width: `${overallPercentage}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm text-amber-500/80 tabular-nums">
                                                {overallPercentage}%
                                            </span>
                                        </div>
                                    )
                                )}
                                <a
                                    href={`/series/${seriesId}`}
                                    className="futuristic-button text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    View Series
                                </a>
                                <ChevronDown
                                    className={`w-6 h-6 text-amber-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="space-y-3 mt-4 border-t border-charcoal-700 pt-4">
                                {Object.entries(progress.seasons || {})
                                    .filter(([seasonNum]) => parseInt(seasonNum) > 0)
                                    .map(([seasonNum, season]) => {
                                        const seasonProgress = getSeasonProgress(parseInt(seasonNum));
                                        const seasonData = seriesSeasonDetails[seriesId]?.[parseInt(seasonNum)];
                                        const watchedEpisodes = season.episodes || [];

                                        return (
                                            <div key={seasonNum} className="bg-charcoal-800/50 p-4 rounded">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-white font-semibold">Season {seasonNum}</span>
                                                        {seasonProgress.total > 0 && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-20 bg-charcoal-900 rounded-full h-2">
                                                                    <div
                                                                        className="bg-amber-500 h-2 rounded-full transition-all"
                                                                        style={{ width: `${seasonProgress.percentage}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs text-amber-500/80">
                                                                    {seasonProgress.watched}/{seasonProgress.total} ({seasonProgress.percentage}%)
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                        season.completed
                                                            ? 'bg-amber-500 text-black'
                                                            : 'bg-charcoal-800 text-white'
                                                    }`}>
                                                        {season.completed ? 'Completed' : `${watchedEpisodes.length} episodes watched`}
                                                    </span>
                                                </div>

                                                {seasonData && seasonData.episodes && seasonData.episodes.length > 0 ? (
                                                    <div className="mt-3 space-y-1">
                                                        {seasonData.episodes.map((episode) => {
                                                            const episodeIsReleased = isEpisodeReleasedOrdered(
                                                                episode,
                                                                seasonData,
                                                                null,
                                                                seriesTvMeta,
                                                            );
                                                            const isWatched = episodeIsReleased && watchedEpisodes.includes(episode.episode_number);
                                                            const isUpcoming = !episodeIsReleased;
                                                            return (
                                                                <div
                                                                    key={episode.id || episode.episode_number}
                                                                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                                                                        isWatched
                                                                            ? 'bg-amber-500/20 text-amber-400'
                                                                            : isUpcoming
                                                                                ? 'bg-red-500/10 text-red-400/70'
                                                                                : 'bg-charcoal-900/50 text-white/40'
                                                                    }`}
                                                                >
                                                                    <span className="font-semibold w-8">E{episode.episode_number}</span>
                                                                    <span className={`flex-1 ${isWatched ? '' : 'opacity-50'}`}>
                                                                        {episode.name || `Episode ${episode.episode_number}`}
                                                                    </span>
                                                                    {isWatched && <span className="text-amber-500">✓</span>}
                                                                    {isUpcoming && <span className="text-red-400 text-[10px]">Upcoming</span>}
                                                                    {episode.air_date && (
                                                                        <span className={`text-[10px] ${isWatched ? 'text-amber-500/70' : 'text-white/30'}`}>
                                                                            {formatDate(episode.air_date)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-white/40 mt-2">No episode data available</div>
                                                )}
                                            </div>
                                        );
                                    })}

                                {Object.entries(progress.seasons || {}).filter(([seasonNum]) => parseInt(seasonNum) === 0).length > 0 && (
                                    <div className="mt-6 pt-4 border-t border-charcoal-700">
                                        <h4 className="text-lg font-bold text-amber-500 mb-3">Specials</h4>
                                        {Object.entries(progress.seasons || {})
                                            .filter(([seasonNum]) => parseInt(seasonNum) === 0)
                                            .map(([seasonNum, season]) => {
                                                const seasonProgress = getSeasonProgress(parseInt(seasonNum));
                                                const seasonData = seriesSeasonDetails[seriesId]?.[parseInt(seasonNum)];
                                                const seasonFromSeries = seriesInfo?.seasons?.find(s => s.season_number === parseInt(seasonNum));
                                                const watchedEpisodes = season.episodes || [];

                                                return (
                                                    <div key={seasonNum} className="bg-charcoal-800/50 p-4 rounded mb-3">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-white font-semibold">{seasonFromSeries?.name || seasonData?.name || 'Special'}</span>
                                                                {seasonProgress.total > 0 && (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-20 bg-charcoal-900 rounded-full h-2">
                                                                            <div
                                                                                className="bg-amber-500 h-2 rounded-full transition-all"
                                                                                style={{ width: `${seasonProgress.percentage}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs text-amber-500/80">
                                                                            {seasonProgress.watched}/{seasonProgress.total} ({seasonProgress.percentage}%)
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                                season.completed ? 'bg-amber-500 text-black' : 'bg-charcoal-800 text-white'
                                                            }`}>
                                                                {season.completed ? 'Completed' : `${watchedEpisodes.length} episodes watched`}
                                                            </span>
                                                        </div>
                                                        {seasonData && seasonData.episodes && seasonData.episodes.length > 0 ? (
                                                            <div className="mt-3 space-y-1">
                                                                {seasonData.episodes.map((episode) => {
                                                                    const episodeIsReleased = isEpisodeReleasedOrdered(
                                                                        episode,
                                                                        seasonData,
                                                                        null,
                                                                        seriesTvMeta,
                                                                    );
                                                                    const isWatched = episodeIsReleased && watchedEpisodes.includes(episode.episode_number);
                                                                    const isUpcoming = !episodeIsReleased;
                                                                    return (
                                                                        <div
                                                                            key={episode.id || episode.episode_number}
                                                                            className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                                                                                isWatched ? 'bg-amber-500/20 text-amber-400'
                                                                                    : isUpcoming ? 'bg-red-500/10 text-red-400/70'
                                                                                        : 'bg-charcoal-900/50 text-white/40'
                                                                            }`}
                                                                        >
                                                                            <span className="font-semibold w-8">E{episode.episode_number}</span>
                                                                            <span className={`flex-1 ${isWatched ? '' : 'opacity-50'}`}>
                                                                                {episode.name || `Episode ${episode.episode_number}`}
                                                                            </span>
                                                                            {isWatched && <span className="text-amber-500">✓</span>}
                                                                            {isUpcoming && <span className="text-red-400 text-[10px]">Upcoming</span>}
                                                                            {episode.air_date && (
                                                                                <span className={`text-[10px] ${isWatched ? 'text-amber-500/70' : 'text-white/30'}`}>
                                                                                    {formatDate(episode.air_date)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-white/40 mt-2">No episode data available</div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
            {totalPages > 1 && (
                <Pagination
                    page={safePage}
                    totalPages={totalPages}
                    onPageChange={setPageInUrl}
                    className="!my-4"
                />
            )}
        </div>
    );
}
