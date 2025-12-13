"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AddToListButton({ itemId, mediaType, itemTitle }) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [lists, setLists] = useState([]);
    const [itemLists, setItemLists] = useState([]);
    const [newListName, setNewListName] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        loadLists();
    }, [itemId, mediaType]);

    const loadLists = async () => {
        if (!user) {
            setLists([]);
            setItemLists([]);
            return;
        }

        try {

            const response = await fetch('/api/custom-lists');
            if (response.ok) {
                const { lists: allLists } = await response.json();
                setLists(allLists || []);

                // Find which lists contain this item by fetching each list with items
                const listsWithItem = [];
                const listPromises = (allLists || []).map(async (list) => {
                    try {
                        const listResponse = await fetch(`/api/custom-lists/${list.id}`);
                        if (listResponse.ok) {
                            const { list: listWithItems } = await listResponse.json();
                            const hasItem = (listWithItems.items || []).some(item => 
                                item.content_id === itemId && item.media_type === mediaType
                            );
                            if (hasItem) {
                                return list.id;
                            }
                        }
                    } catch (error) {
                        console.error(`Error checking list ${list.id}:`, error);
                    }
                    return null;
                });

                const results = await Promise.all(listPromises);
                setItemLists(results.filter(id => id !== null));
            }
        } catch (error) {
            console.error('Error loading lists:', error);
        }
    };

    const handleToggleList = async (listId) => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        // Validate itemTitle - provide fallback if missing
        const validTitle = itemTitle?.trim() || 'Untitled';
        if (!itemId || !mediaType) {
            setError('Missing required item information');
            setTimeout(() => setError(null), 3000);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const isInList = itemLists.includes(listId);

            if (isInList) {
                // Remove from list via API
                const response = await fetch(`/api/custom-lists/${listId}/items?contentId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setItemLists(prev => prev.filter(id => id !== listId));
                    setSuccess('Removed from list');
                    setTimeout(() => setSuccess(null), 2000);
                    await loadLists(); // Refresh to ensure state is in sync
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to remove from list');
                }
            } else {
                // Add to list via API
                const response = await fetch(`/api/custom-lists/${listId}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contentId: itemId,
                        mediaType,
                        title: validTitle,
                    }),
                });
                if (response.ok) {
                    setItemLists(prev => [...prev, listId]);
                    setSuccess('Added to list');
                    setTimeout(() => setSuccess(null), 2000);
                    await loadLists(); // Refresh to ensure state is in sync
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to add to list');
                }
            }
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        } catch (error) {
            console.error('Error toggling list:', error);
            setError(error.message || 'An error occurred');
            setTimeout(() => setError(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateList = async () => {
        if (!newListName.trim()) {
            setError('List name is required');
            setTimeout(() => setError(null), 3000);
            return;
        }

        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        // Validate itemTitle - provide fallback if missing
        const validTitle = itemTitle?.trim() || 'Untitled';
        if (!itemId || !mediaType) {
            setError('Missing required item information');
            setTimeout(() => setError(null), 3000);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            // Create list via API
            const response = await fetch('/api/custom-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newListName.trim(),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to create list');
            }

            const { list } = await response.json();
            
            // Add current item to the new list
            const addResponse = await fetch(`/api/custom-lists/${list.id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: itemId,
                    mediaType,
                    title: validTitle,
                }),
            });

            if (!addResponse.ok) {
                const errorData = await addResponse.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to add item to list');
            }

            setNewListName('');
            setShowCreateForm(false);
            setSuccess('List created and item added');
            setTimeout(() => setSuccess(null), 2000);
            
            // Refresh lists and item lists state
            await loadLists();
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        } catch (error) {
            console.error('Error creating list:', error);
            setError(error.message || 'Failed to create list');
            setTimeout(() => setError(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={loading}
                className="futuristic-button flex items-center gap-2"
            >
                <span>📋</span>
                <span>Add to List</span>
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-10 bg-black/50" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="fixed sm:absolute sm:top-full sm:left-0 sm:mt-2 inset-4 sm:inset-auto z-20 bg-charcoal-900 border border-amber-500/50 rounded-lg shadow-subtle p-4 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[280px] sm:max-w-sm max-h-[calc(100vh-2rem)] flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-amber-400 font-bold">Your Lists</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>
                        
                        {error && (
                            <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                        
                        {success && (
                            <div className="mb-3 p-2 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-sm">
                                {success}
                            </div>
                        )}

                        {lists.length === 0 && !showCreateForm && (
                            <p className="text-white/70 text-sm mb-3">No lists yet. Create one!</p>
                        )}

                        <div className="space-y-2 flex-1 overflow-y-auto mb-3 min-h-0">
                            {lists.map(list => {
                                const isInList = itemLists.includes(list.id);
                                return (
                                    <button
                                        key={list.id}
                                        onClick={() => handleToggleList(list.id)}
                                        disabled={loading}
                                        className={`w-full text-left px-3 py-3 rounded transition-all min-h-[44px] flex flex-col justify-center ${
                                            isInList
                                                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                                                : 'bg-charcoal-800/50 hover:bg-charcoal-800 text-white'
                                        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">{list.name}</span>
                                            <span>{isInList ? '✓' : '+'}</span>
                                        </div>
                                        {list.is_public && (
                                            <span className="text-xs text-amber-400/80 mt-1">
                                                Public
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {showCreateForm ? (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    placeholder="List name"
                                    className="w-full px-3 py-2 bg-charcoal-800 border border-amber-500/50 rounded text-white placeholder-white/50 focus:outline-none focus:border-amber-400"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCreateList();
                                        }
                                    }}
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCreateList}
                                        disabled={loading}
                                        className="flex-1 futuristic-button-yellow text-sm py-3 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? 'Creating...' : 'Create'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowCreateForm(false);
                                            setNewListName('');
                                            setError(null);
                                        }}
                                        disabled={loading}
                                        className="flex-1 futuristic-button text-sm py-3 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowCreateForm(true)}
                                disabled={loading}
                                className="w-full futuristic-button-yellow text-sm py-3 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                + Create New List
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

