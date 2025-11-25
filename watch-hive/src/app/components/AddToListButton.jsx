"use client";
import { useState, useEffect } from 'react';

// Simple list storage (can be extended to use API/backend later)
const getLists = () => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem('watchhive_custom_lists');
    return data ? JSON.parse(data) : [];
};

const saveLists = (lists) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('watchhive_custom_lists', JSON.stringify(lists));
};

const getItemLists = (itemId, mediaType) => {
    const lists = getLists();
    return lists.filter(list => 
        list.items.some(item => item.id === String(itemId) && item.mediaType === mediaType)
    ).map(list => list.id);
};

export default function AddToListButton({ itemId, mediaType, itemTitle }) {
    const [isOpen, setIsOpen] = useState(false);
    const [lists, setLists] = useState([]);
    const [itemLists, setItemLists] = useState([]);
    const [newListName, setNewListName] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);

    useEffect(() => {
        loadLists();
    }, [itemId, mediaType]);

    const loadLists = () => {
        const allLists = getLists();
        setLists(allLists);
        setItemLists(getItemLists(itemId, mediaType));
    };

    const handleToggleList = (listId) => {
        const allLists = getLists();
        const list = allLists.find(l => l.id === listId);
        
        if (!list) return;

        const isInList = list.items.some(
            item => item.id === String(itemId) && item.mediaType === mediaType
        );

        if (isInList) {
            // Remove from list
            list.items = list.items.filter(
                item => !(item.id === String(itemId) && item.mediaType === mediaType)
            );
        } else {
            // Add to list
            list.items.push({
                id: String(itemId),
                mediaType,
                title: itemTitle,
                dateAdded: new Date().toISOString(),
            });
        }

        saveLists(allLists);
        loadLists();
        window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
    };

    const handleCreateList = () => {
        if (!newListName.trim()) return;

        const allLists = getLists();
        const newList = {
            id: Date.now().toString(),
            name: newListName.trim(),
            items: [{
                id: String(itemId),
                mediaType,
                title: itemTitle,
                dateAdded: new Date().toISOString(),
            }],
            createdAt: new Date().toISOString(),
        };

        allLists.push(newList);
        saveLists(allLists);
        setNewListName('');
        setShowCreateForm(false);
        loadLists();
        window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
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
                    <div className="absolute top-full left-0 mt-2 z-20 bg-futuristic-blue-900 border border-futuristic-yellow-500/50 rounded-lg shadow-glow-yellow p-4 min-w-[280px] max-w-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-futuristic-yellow-400 font-bold">Your Lists</h3>
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
                                                ? 'bg-futuristic-yellow-500/20 border border-futuristic-yellow-500/50 text-futuristic-yellow-400'
                                                : 'bg-futuristic-blue-800/50 hover:bg-futuristic-blue-800 text-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">{list.name}</span>
                                            <span>{isInList ? '✓' : '+'}</span>
                                        </div>
                                        <span className="text-xs text-white/60">
                                            {list.items.length} item{list.items.length !== 1 ? 's' : ''}
                                        </span>
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
                                    className="w-full px-3 py-2 bg-futuristic-blue-800 border border-futuristic-yellow-500/50 rounded text-white placeholder-white/50 focus:outline-none focus:border-futuristic-yellow-400"
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

