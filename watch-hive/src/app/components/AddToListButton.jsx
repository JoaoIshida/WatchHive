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

        setLoading(true);
        try {

            const isInList = itemLists.includes(listId);

            if (isInList) {
                // Remove from list via API
                const response = await fetch(`/api/custom-lists/${listId}/items?contentId=${itemId}&mediaType=${mediaType}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setItemLists(prev => prev.filter(id => id !== listId));
                }
            } else {
                // Add to list via API
                const response = await fetch(`/api/custom-lists/${listId}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contentId: itemId,
                        mediaType,
                        title: itemTitle,
                    }),
                });
                if (response.ok) {
                    setItemLists(prev => [...prev, listId]);
                }
            }
            window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        } catch (error) {
            console.error('Error toggling list:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateList = async () => {
        if (!newListName.trim()) return;

        if (!user) {
            window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'signin' } }));
            return;
        }

        setLoading(true);
        try {

            // Create list via API
            const response = await fetch('/api/custom-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newListName.trim(),
                }),
            });

            if (response.ok) {
                const { list } = await response.json();
                
                // Add current item to the new list
                await fetch(`/api/custom-lists/${list.id}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contentId: itemId,
                        mediaType,
                        title: itemTitle,
                    }),
                });

                setNewListName('');
                setShowCreateForm(false);
                loadLists();
                window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
            }
        } catch (error) {
            console.error('Error creating list:', error);
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
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 z-20 bg-charcoal-900 border border-amber-500/50 rounded-lg shadow-subtle p-4 min-w-[280px] max-w-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-amber-400 font-bold">Your Lists</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white/70 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        {lists.length === 0 && !showCreateForm && (
                            <p className="text-white/70 text-sm mb-3">No lists yet. Create one!</p>
                        )}

                        <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
                            {lists.map(list => {
                                const isInList = itemLists.includes(list.id);
                                return (
                                    <button
                                        key={list.id}
                                        onClick={() => handleToggleList(list.id)}
                                        className={`w-full text-left px-3 py-2 rounded transition-all ${
                                            isInList
                                                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                                                : 'bg-charcoal-800/50 hover:bg-charcoal-800 text-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">{list.name}</span>
                                            <span>{isInList ? '✓' : '+'}</span>
                                        </div>
                                        {list.is_public && (
                                            <span className="text-xs text-amber-400/80">
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
                                        className="flex-1 futuristic-button-yellow text-sm py-2"
                                    >
                                        Create
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowCreateForm(false);
                                            setNewListName('');
                                        }}
                                        className="flex-1 futuristic-button text-sm py-2"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="w-full futuristic-button-yellow text-sm py-2"
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

