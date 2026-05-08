"use client";
import { useMemo, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import ContentCard from '../components/ContentCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import { parsePageParam, parseSortParam, useReplaceQuery } from './useReplaceQuery';

const WISHLIST_PAGE_SIZE = 18;
const WISHLIST_SORTS = ['date-desc', 'date-asc', 'name-asc', 'name-desc'];

function displayTitle(item) {
    return String(item.title ?? item.name ?? '');
}

export default function ProfileWishlistSection({ loadingWishlistDetails, wishlistDetails }) {
    const { replaceParams, searchParams } = useReplaceQuery();
    const page = useMemo(() => parsePageParam(searchParams, 'page'), [searchParams]);
    const sortMode = useMemo(
        () => parseSortParam(searchParams, WISHLIST_SORTS, 'date-desc'),
        [searchParams]
    );

    const sortedItems = useMemo(() => {
        const tie = (a, b) => {
            const ia = Number(a.id);
            const ib = Number(b.id);
            if (Number.isFinite(ia) && Number.isFinite(ib) && ia !== ib) return ia - ib;
            return String(a.media_type).localeCompare(String(b.media_type));
        };
        return [...wishlistDetails].sort((a, b) => {
            if (sortMode === 'name-asc') {
                const c = displayTitle(a).localeCompare(displayTitle(b), undefined, { sensitivity: 'base' });
                return c !== 0 ? c : tie(a, b);
            }
            if (sortMode === 'name-desc') {
                const c = displayTitle(b).localeCompare(displayTitle(a), undefined, { sensitivity: 'base' });
                return c !== 0 ? c : tie(a, b);
            }
            const dateA = new Date(a.dateAdded || 0).getTime();
            const dateB = new Date(b.dateAdded || 0).getTime();
            if (sortMode === 'date-asc') {
                if (dateA !== dateB) return dateA - dateB;
                return tie(a, b);
            }
            if (dateB !== dateA) return dateB - dateA;
            return tie(a, b);
        });
    }, [wishlistDetails, sortMode]);

    const totalPages = Math.max(1, Math.ceil(sortedItems.length / WISHLIST_PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageItems = sortedItems.slice((safePage - 1) * WISHLIST_PAGE_SIZE, safePage * WISHLIST_PAGE_SIZE);

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
                <Bookmark className="w-12 h-12 mx-auto text-amber-500/50 mb-3" aria-hidden />
                <p className="text-xl text-white mb-2">Your wishlist is empty</p>
                <p className="text-amber-500/80">Use the save icon on a title to add it to your wishlist.</p>
            </div>
        );
    }
    return (
        <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="text-sm text-amber-500/80">
                    Showing {(safePage - 1) * WISHLIST_PAGE_SIZE + 1}–{(safePage - 1) * WISHLIST_PAGE_SIZE + pageItems.length} of {sortedItems.length}{' '}
                    {sortedItems.length === 1 ? 'item' : 'items'} in wishlist
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-white/70">Sort:</span>
                    <select
                        value={sortMode}
                        onChange={(e) => setSortInUrl(e.target.value)}
                        className="rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm font-semibold text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        aria-label="Sort wishlist"
                    >
                        <option value="date-desc">Added date (newest)</option>
                        <option value="date-asc">Added date (oldest)</option>
                        <option value="name-asc">Title A–Z</option>
                        <option value="name-desc">Title Z–A</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {pageItems.map((item) => {
                    const href = item.media_type === 'movie' ? `/movies/${item.id}` : `/series/${item.id}`;

                    return (
                        <div key={`${item.media_type}-${item.id}`} className="relative">
                            <ContentCard item={item} mediaType={item.media_type} href={href} />
                            {item.dateAdded && (
                                <div className="absolute bottom-2 right-2 bg-charcoal-800/90 text-white text-[8px] px-1.5 py-0.5 rounded z-20">
                                    Added {new Date(item.dateAdded).toLocaleDateString()}
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
    );
}
