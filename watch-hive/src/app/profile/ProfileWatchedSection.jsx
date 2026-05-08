"use client";
import { useMemo, useEffect } from 'react';
import ContentCard from '../components/ContentCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import { parsePageParam, parseSortParam, useReplaceQuery } from './useReplaceQuery';

const WATCHED_PAGE_SIZE = 18;
const WATCHED_SORTS = ['date-desc', 'date-asc', 'name-asc', 'name-desc'];

function displayTitle(item) {
    return String(item.title ?? item.name ?? '');
}

export default function ProfileWatchedSection({ watchedDetails, watchedFilter, setWatchedFilter, loadingDetails }) {
    const { replaceParams, searchParams } = useReplaceQuery();
    const page = useMemo(() => parsePageParam(searchParams, 'page'), [searchParams]);
    const sortMode = useMemo(
        () => parseSortParam(searchParams, WATCHED_SORTS, 'date-desc'),
        [searchParams]
    );

    const sortedFilteredItems = useMemo(() => {
        const filtered = watchedDetails.filter((item) => {
            if (watchedFilter === 'all') return true;
            if (watchedFilter === 'movie') return item.media_type === 'movie';
            if (watchedFilter === 'tv') return item.media_type === 'tv';
            return true;
        });
        const tie = (a, b) => {
            const ia = Number(a.id);
            const ib = Number(b.id);
            if (Number.isFinite(ia) && Number.isFinite(ib) && ia !== ib) return ia - ib;
            return String(a.media_type).localeCompare(String(b.media_type));
        };
        return filtered.sort((a, b) => {
            if (sortMode === 'name-asc') {
                const c = displayTitle(a).localeCompare(displayTitle(b), undefined, { sensitivity: 'base' });
                return c !== 0 ? c : tie(a, b);
            }
            if (sortMode === 'name-desc') {
                const c = displayTitle(b).localeCompare(displayTitle(a), undefined, { sensitivity: 'base' });
                return c !== 0 ? c : tie(a, b);
            }
            const dateA = new Date(a.dateWatched || 0).getTime();
            const dateB = new Date(b.dateWatched || 0).getTime();
            if (sortMode === 'date-asc') {
                if (dateA !== dateB) return dateA - dateB;
                return tie(a, b);
            }
            if (dateB !== dateA) return dateB - dateA;
            return tie(a, b);
        });
    }, [watchedDetails, watchedFilter, sortMode]);

    const totalPages = Math.max(1, Math.ceil(sortedFilteredItems.length / WATCHED_PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageItems = sortedFilteredItems.slice((safePage - 1) * WATCHED_PAGE_SIZE, safePage * WATCHED_PAGE_SIZE);

    useEffect(() => {
        if (page > totalPages) {
            replaceParams((next) => {
                if (totalPages <= 1) next.delete('page');
                else next.set('page', String(totalPages));
            });
        }
    }, [totalPages, page, replaceParams]);

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

    const onFilterClick = (filter) => {
        setWatchedFilter(filter);
        replaceParams((next) => next.delete('page'));
    };

    if (loadingDetails) {
        return (
            <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading watched…" />
            </div>
        );
    }
    return (
        <div>
            {watchedDetails.length === 0 ? (
                <div className="text-center py-12 futuristic-card">
                    <p className="text-xl text-white mb-2">No watched items yet</p>
                    <p className="text-amber-500/80">Start watching and mark items as watched to see them here!</p>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm text-white/70">Filter:</span>
                            <button
                                type="button"
                                onClick={() => onFilterClick('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    watchedFilter === 'all'
                                        ? 'bg-amber-500 text-black'
                                        : 'bg-charcoal-800 text-white hover:bg-charcoal-700'
                                }`}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => onFilterClick('movie')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    watchedFilter === 'movie'
                                        ? 'bg-amber-500 text-black'
                                        : 'bg-charcoal-800 text-white hover:bg-charcoal-700'
                                }`}
                            >
                                Movies
                            </button>
                            <button
                                type="button"
                                onClick={() => onFilterClick('tv')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    watchedFilter === 'tv'
                                        ? 'bg-amber-500 text-black'
                                        : 'bg-charcoal-800 text-white hover:bg-charcoal-700'
                                }`}
                            >
                                Series
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-white/70">Sort:</span>
                            <select
                                value={sortMode}
                                onChange={(e) => setSortInUrl(e.target.value)}
                                className="rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm font-semibold text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                aria-label="Sort watched list"
                            >
                                <option value="date-desc">Watched date (newest)</option>
                                <option value="date-asc">Watched date (oldest)</option>
                                <option value="name-asc">Title A–Z</option>
                                <option value="name-desc">Title Z–A</option>
                            </select>
                        </div>
                    </div>

                    {sortedFilteredItems.length === 0 ? (
                        <div className="text-center py-12 futuristic-card">
                            <p className="text-xl text-white mb-2">
                                No {watchedFilter === 'movie' ? 'movies' : watchedFilter === 'tv' ? 'series' : 'items'} watched yet
                            </p>
                            <p className="text-amber-500/80">
                                Start watching {watchedFilter === 'movie' ? 'movies' : watchedFilter === 'tv' ? 'series' : 'content'} to see them here!
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 text-sm text-amber-500/80">
                                Showing {(safePage - 1) * WATCHED_PAGE_SIZE + 1}–{(safePage - 1) * WATCHED_PAGE_SIZE + pageItems.length} of{' '}
                                {sortedFilteredItems.length} {sortedFilteredItems.length === 1 ? 'item' : 'items'}
                                {watchedFilter !== 'all' && (
                                    <span> ({watchedDetails.length} total in library)</span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {pageItems.map((item) => {
                                    const href =
                                        item.media_type === 'movie' ? `/movies/${item.id}` : `/series/${item.id}`;

                                    return (
                                        <div key={`${item.media_type}-${item.id}`} className="relative">
                                            <ContentCard item={item} mediaType={item.media_type} href={href} />
                                            {item.dateWatched && (
                                                <div className="absolute bottom-2 right-2 bg-charcoal-800/90 text-white text-[8px] px-1.5 py-0.5 rounded z-20">
                                                    {new Date(item.dateWatched).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {totalPages > 1 && (
                                <Pagination page={safePage} totalPages={totalPages} onPageChange={setPageInUrl} className="!my-4" />
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
