"use client";
import { useState, useEffect, useRef } from 'react';
import { watchedStorage } from '../lib/localStorage';
import { wishlistStorage } from '../lib/localStorage';
import { isMovieReleased, isSeriesReleased } from '../utils/releaseDateValidator';
import { formatDate } from '../utils/dateFormatter';

// Simple list storage helper
const getLists = () => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem('watchhive_custom_lists');
    return data ? JSON.parse(data) : [];
};

const saveLists = (lists) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('watchhive_custom_lists', JSON.stringify(lists));
};

export default function QuickActionsMenu({ itemId, mediaType, itemData, onUpdate }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isWatched, setIsWatched] = useState(false);
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [itemLists, setItemLists] = useState([]);
    const menuRef = useRef(null);

    useEffect(() => {
        // Check initial states
        const watched = watchedStorage.isWatched(String(itemId), mediaType);
        const inWishlist = wishlistStorage.isInWishlist(String(itemId), mediaType);
        const lists = getLists();
        const itemListIds = lists.filter(list => 
            list.items.some(item => item.id === String(itemId) && item.mediaType === mediaType)
        ).map(list => list.id);

        setIsWatched(watched);
        setIsInWishlist(inWishlist);
        setItemLists(itemListIds);
    }, [itemId, mediaType]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggleWatched = async () => {
        if (isWatched) {
            watchedStorage.remove(String(itemId), mediaType);
            setIsWatched(false);
        } else {
            // Check if item is released before marking as watched
            if (mediaType === 'movie' && itemData && !isMovieReleased(itemData)) {
                alert(`This movie is not yet released. Release date: ${formatDate(itemData.release_date)}`);
                return;
            } else if (mediaType === 'tv' && itemData && !isSeriesReleased(itemData)) {
                alert(`This series is not yet released. Release date: ${formatDate(itemData.first_air_date)}`);
                return;
            }
            
            watchedStorage.add(String(itemId), mediaType);
            setIsWatched(true);
        }
        window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        if (onUpdate) onUpdate();
        setIsOpen(false);
    };

    const handleToggleWishlist = () => {
        if (isInWishlist) {
            wishlistStorage.remove(String(itemId), mediaType);
            setIsInWishlist(false);
        } else {
            wishlistStorage.add(String(itemId), mediaType);
            setIsInWishlist(true);
        }
        window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        if (onUpdate) onUpdate();
        setIsOpen(false);
    };

    const handleAddToList = () => {
        const lists = getLists();
        const defaultList = lists.find(l => l.name === 'My List');
        
        if (!defaultList) {
            // Create default list
            const newList = {
                id: Date.now().toString(),
                name: 'My List',
                items: [{
                    id: String(itemId),
                    mediaType,
                    title: itemData?.title || itemData?.name || 'Untitled',
                    dateAdded: new Date().toISOString(),
                }],
                createdAt: new Date().toISOString(),
            };
            lists.push(newList);
        } else {
            // Add to existing list if not already there
            const isInList = defaultList.items.some(
                item => item.id === String(itemId) && item.mediaType === mediaType
            );
            if (!isInList) {
                defaultList.items.push({
                    id: String(itemId),
                    mediaType,
                    title: itemData?.title || itemData?.name || 'Untitled',
                    dateAdded: new Date().toISOString(),
                });
            }
        }
        
        saveLists(lists);
        const updatedLists = getLists();
        const updatedItemListIds = updatedLists.filter(list => 
            list.items.some(item => item.id === String(itemId) && item.mediaType === mediaType)
        ).map(list => list.id);
        setItemLists(updatedItemListIds);
        window.dispatchEvent(new CustomEvent('watchhive-data-updated'));
        if (onUpdate) onUpdate();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center bg-futuristic-blue-950/90 backdrop-blur-sm rounded-full border border-futuristic-yellow-500/50 hover:bg-futuristic-blue-900 hover:border-futuristic-yellow-400 transition-all"
                aria-label="Quick actions"
            >
                <svg 
                    className="w-4 h-4 text-futuristic-yellow-400" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                >
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-10 right-0 z-30 bg-futuristic-blue-900 border border-futuristic-yellow-500/50 rounded-lg shadow-glow-yellow py-2 min-w-[180px]">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleWatched();
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-futuristic-blue-800 text-white text-sm flex items-center gap-2"
                    >
                        {isWatched ? (
                            <>
                                <span>✓</span>
                                <span>Remove from Watched</span>
                            </>
                        ) : (
                            <>
                                <span>+</span>
                                <span>Mark as Watched</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleWishlist();
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-futuristic-blue-800 text-white text-sm flex items-center gap-2"
                    >
                        {isInWishlist ? (
                            <>
                                <span>★</span>
                                <span>Remove from Wishlist</span>
                            </>
                        ) : (
                            <>
                                <span>☆</span>
                                <span>Add to Wishlist</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddToList();
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-futuristic-blue-800 text-white text-sm flex items-center gap-2"
                    >
                        <span>📋</span>
                        <span>Add to List</span>
                    </button>
                </div>
            )}
        </div>
    );
}

