"use client";
import React, { useState, useEffect } from 'react';
import ContentCard from '../../components/ContentCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useParams } from 'next/navigation';

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

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-amber-500 mb-2">{list.name}</h1>
                {list.description && (
                    <p className="text-white/70 text-base mb-4">{list.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-white/40">
                    <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    <span>Created {new Date(list.created_at).toLocaleDateString()}</span>
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
