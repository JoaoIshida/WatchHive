"use client";
import React, { useState, useEffect } from 'react';
import ContentCard from '../../components/ContentCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MOCK_FRIEND_USER_ID, isLocalhost } from '../../utils/mockUser';
import { isMockListId } from '../../utils/mockPublicLists';
import { getListIconMeta } from '../../utils/listIconHelper';

const PublicListPage = () => {
    const params = useParams();
    const listId = params.id;
    const [list, setList] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchList = async () => {
            try {
                const res = await fetch(`/api/public-lists/${listId}`);
                if (!res.ok) {
                    setError(res.status === 404 ? 'List not found or is private.' : 'Failed to load list.');
                    return;
                }
                const data = await res.json();
                setList(data.list);
            } catch {
                setError('Failed to load list.');
            } finally {
                setLoading(false);
            }
        };
        fetchList();
    }, [listId]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-16 flex justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-16 text-center">
                <h1 className="text-2xl font-bold text-white mb-2">{error}</h1>
                <a href="/browse" className="text-amber-500 hover:text-amber-400">Back to Browse</a>
            </div>
        );
    }

    const items = (list?.items || []).filter((item) => item.details);
    const { Icon: ListIcon, className: listIconClassName } = getListIconMeta(list, {
        shared: list && !list.is_public,
    });

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-8">
                {isLocalhost() && isMockListId(listId) && (
                    <Link
                        href={`/profile/${MOCK_FRIEND_USER_ID}`}
                        className="text-white/50 hover:text-amber-500 text-sm mb-4 inline-block"
                    >
                        ← Back to Mock Friend&apos;s profile
                    </Link>
                )}
                <h1 className="text-4xl font-bold text-amber-500 mb-2 flex items-center gap-3">
                    <ListIcon className={`w-9 h-9 flex-shrink-0 ${listIconClassName}`} aria-hidden />
                    {list.name}
                </h1>
                {list.description && (
                    <p className="text-white/70 text-base mb-4">{list.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/40">
                    <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    {isLocalhost() && isMockListId(listId) && (
                        <span className="text-amber-500/70 text-xs">Sample preview data</span>
                    )}
                    {!list.is_public && (
                        <span className="text-amber-500/80 text-xs font-semibold uppercase tracking-wide">Shared</span>
                    )}
                </div>
            </div>

            {items.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {items.map((item) => {
                        const d = item.details;
                        const mediaType = item.media_type === 'movie' ? 'movie' : 'tv';
                        const href = mediaType === 'movie' ? `/movies/${d.id}` : `/series/${d.id}`;
                        return (
                            <ContentCard
                                key={`${item.media_type}-${item.content_id}`}
                                item={d}
                                mediaType={mediaType}
                                href={href}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12">
                    <p className="text-white/60 text-lg">This list is empty.</p>
                </div>
            )}
        </div>
    );
};

export default PublicListPage;
