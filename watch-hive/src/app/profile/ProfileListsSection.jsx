"use client";
import { ChevronRight, Settings } from 'lucide-react';
import ContentCard from '../components/ContentCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate } from '../utils/dateFormatter';

export default function ProfileListsSection({
    customLists,
    listDetails,
    loadingListDetails,
    user,
    expandedListIds,
    setExpandedListIds,
    loadListDetails,
    showCreateListForm,
    setShowCreateListForm,
    newListName,
    setNewListName,
    newListDescription,
    setNewListDescription,
    newListIsPublic,
    setNewListIsPublic,
    createListError,
    setCreateListError,
    createListLoading,
    setCreateListLoading,
    setListSettingsModalList,
    refreshUserData,
}) {
    return (
        <div>
            {showCreateListForm && (
                <div className="futuristic-card p-6 mb-6">
                    <h3 className="text-lg font-bold text-amber-500 mb-4">Create new list</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-white font-semibold mb-1">Name (required)</label>
                            <input
                                type="text"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                className="w-full px-4 py-2 bg-charcoal-900/50 border border-charcoal-700/50 rounded text-white focus:outline-none focus:border-amber-500"
                                placeholder="List name"
                            />
                        </div>
                        <div>
                            <label className="block text-white font-semibold mb-1">Description (optional)</label>
                            <textarea
                                value={newListDescription}
                                onChange={(e) => setNewListDescription(e.target.value)}
                                className="w-full px-4 py-2 bg-charcoal-900/50 border border-charcoal-700/50 rounded text-white focus:outline-none focus:border-amber-500"
                                placeholder="Description"
                                rows={2}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="newListIsPublic"
                                checked={newListIsPublic}
                                onChange={(e) => setNewListIsPublic(e.target.checked)}
                                className="rounded border-charcoal-600 bg-charcoal-800 text-amber-500 focus:ring-amber-500"
                            />
                            <label htmlFor="newListIsPublic" className="text-white">Public (everyone can see)</label>
                        </div>
                        {createListError && <p className="text-red-400 text-sm">{createListError}</p>}
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!newListName.trim()) {
                                        setCreateListError('List name is required');
                                        return;
                                    }
                                    setCreateListLoading(true);
                                    setCreateListError(null);
                                    try {
                                        const res = await fetch('/api/custom-lists', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                name: newListName.trim(),
                                                description: newListDescription.trim() || null,
                                                isPublic: newListIsPublic,
                                            }),
                                        });
                                        if (!res.ok) {
                                            const data = await res.json().catch(() => ({}));
                                            throw new Error(data.error || 'Failed to create list');
                                        }
                                        setNewListName('');
                                        setNewListDescription('');
                                        setNewListIsPublic(false);
                                        setShowCreateListForm(false);
                                        await refreshUserData();
                                    } catch (err) {
                                        setCreateListError(err.message || 'Failed to create list');
                                    } finally {
                                        setCreateListLoading(false);
                                    }
                                }}
                                disabled={createListLoading}
                                className="futuristic-button-yellow px-4 py-2 disabled:opacity-50"
                            >
                                {createListLoading ? 'Creating...' : 'Create list'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCreateListForm(false);
                                    setNewListName('');
                                    setNewListDescription('');
                                    setNewListIsPublic(false);
                                    setCreateListError(null);
                                }}
                                className="futuristic-button px-4 py-2"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {customLists.length === 0 && !showCreateListForm ? (
                <div className="text-center py-12 futuristic-card">
                    <p className="text-xl text-white mb-2">No custom lists yet</p>
                    <p className="text-amber-500/80 mb-4">Create lists and add movies/series to organize your content!</p>
                    <button
                        onClick={() => setShowCreateListForm(true)}
                        className="futuristic-button-yellow px-6 py-3"
                    >
                        Create your first list
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {!showCreateListForm && (
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowCreateListForm(true)}
                                className="futuristic-button-yellow px-4 py-2"
                            >
                                New list
                            </button>
                        </div>
                    )}
                    {customLists.map((list) => {
                        const loadedItems = listDetails[list.id];
                        const items = loadedItems || [];
                        const isLoadingList = loadingListDetails[list.id];
                        const canEditSettings = list.user_id === user?.id || list.my_permission === 'admin';
                        const isExpanded = expandedListIds.includes(list.id);
                        const toggleExpanded = () => {
                            const willExpand = !expandedListIds.includes(list.id);
                            setExpandedListIds((prev) =>
                                prev.includes(list.id) ? prev.filter((id) => id !== list.id) : [...prev, list.id]
                            );
                            if (willExpand && listDetails[list.id] === undefined) {
                                loadListDetails(list.id);
                            }
                        };
                        const collapsedCount = typeof list.items_count === 'number' ? list.items_count : 0;
                        let itemCountSubtitle;
                        if (isLoadingList) {
                            itemCountSubtitle = 'Loading...';
                        } else if (loadedItems !== undefined) {
                            const n = items.length;
                            itemCountSubtitle = `${n} ${n === 1 ? 'item' : 'items'}`;
                        } else {
                            const n = collapsedCount;
                            itemCountSubtitle = `${n} ${n === 1 ? 'item' : 'items'}`;
                        }
                        return (
                            <div key={list.id} className="futuristic-card p-6">
                                <div
                                    className="flex items-center justify-between cursor-pointer select-none group"
                                    onClick={toggleExpanded}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleExpanded();
                                        }
                                    }}
                                    aria-expanded={isExpanded}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <ChevronRight
                                            className={`w-5 h-5 text-amber-500/80 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                        />
                                        <div className="min-w-0">
                                            <h3 className="text-xl font-bold text-amber-500 group-hover:text-amber-400 transition-colors">
                                                {list.name}
                                            </h3>
                                            <p className="text-sm text-white/70 mt-1">
                                                {itemCountSubtitle} • Created {formatDate(list.created_at)}
                                                {list.is_public !== undefined && (
                                                    <span className="ml-2 text-white/50">
                                                        {list.is_public ? ' • Public' : ' • Private'}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        {canEditSettings && (
                                            <button
                                                onClick={() => setListSettingsModalList(list)}
                                                className="futuristic-button text-sm px-3 py-2"
                                                title="List settings"
                                            >
                                                <Settings className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <>
                                        {isLoadingList ? (
                                            <div className="flex justify-center py-8">
                                                <LoadingSpinner size="md" />
                                            </div>
                                        ) : items.length === 0 ? (
                                            <p className="text-white/60 text-center py-4 mt-4">This list is empty</p>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
                                                {items.map((item) => {
                                                    const href = item.media_type === 'movie'
                                                        ? `/movies/${item.id}`
                                                        : `/series/${item.id}`;
                                                    return (
                                                        <div key={`${item.media_type}-${item.id}`} className="relative">
                                                            <ContentCard
                                                                item={item}
                                                                mediaType={item.media_type}
                                                                href={href}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
