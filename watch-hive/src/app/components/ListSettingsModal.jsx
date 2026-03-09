"use client";
import { useState, useEffect, useCallback } from 'react';
import ConfirmationModal from './ConfirmationModal';

const ListSettingsModal = ({ list, currentUserId, onClose, onSaved }) => {
    const [name, setName] = useState(list?.name || '');
    const [description, setDescription] = useState(list?.description || '');
    const [isPublic, setIsPublic] = useState(list?.is_public ?? false);
    const [collaborators, setCollaborators] = useState([]);
    const [loadingCollab, setLoadingCollab] = useState(true);
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [addPermission, setAddPermission] = useState('viewer');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const isOwner = list && currentUserId && list.user_id === currentUserId;

    const loadCollaborators = useCallback(async () => {
        if (!list?.id) return;
        setLoadingCollab(true);
        try {
            const res = await fetch(`/api/custom-lists/${list.id}/collaborators`);
            if (res.ok) {
                const data = await res.json();
                const collabList = data.collaborators || [];
                setCollaborators(collabList.map((c) => ({
                    id: c.id,
                    user_id: c.user_id,
                    permission: c.permission,
                    display_name: c.profiles?.display_name ?? c.display_name ?? 'Unknown',
                })));
            }
        } catch (e) {
            console.error('Error loading collaborators:', e);
        } finally {
            setLoadingCollab(false);
        }
    }, [list?.id]);

    const isOpen = !!list;

    useEffect(() => {
        setName(list?.name || '');
        setDescription(list?.description || '');
        setIsPublic(list?.is_public ?? false);
        if (list?.id) loadCollaborators();
    }, [list?.id, list?.name, list?.description, list?.is_public, loadCollaborators]);

    useEffect(() => {
        if (!isOpen) return;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSearch = async () => {
        const q = searchQuery.trim();
        if (q.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                const existingIds = new Set([list.user_id, ...collaborators.map((c) => c.user_id)]);
                setSearchResults((data.users || []).filter((u) => !existingIds.has(u.id)));
            } else {
                setSearchResults([]);
            }
        } catch (e) {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    const handleAddCollaborator = async (userId) => {
        try {
            const res = await fetch(`/api/custom-lists/${list.id}/collaborators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, permission: addPermission }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to add');
            }
            setSearchQuery('');
            setSearchResults([]);
            await loadCollaborators();
        } catch (e) {
            setSaveError(e.message);
        }
    };

    const handleRemoveCollaborator = async (userId) => {
        try {
            const res = await fetch(`/api/custom-lists/${list.id}/collaborators?userId=${encodeURIComponent(userId)}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to remove');
            await loadCollaborators();
        } catch (e) {
            setSaveError(e.message);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setSaveError('List name is required');
            return;
        }
        setSaveLoading(true);
        setSaveError(null);
        try {
            const res = await fetch(`/api/custom-lists/${list.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    isPublic,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to save');
            }
            onSaved?.();
            onClose?.();
        } catch (e) {
            setSaveError(e.message);
        } finally {
            setSaveLoading(false);
        }
    };

    const handleDelete = async () => {
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/custom-lists/${list.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            setShowDeleteConfirm(false);
            onSaved?.();
            onClose?.();
        } catch (e) {
            setSaveError(e.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
                <div
                    className="futuristic-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-charcoal-700 shadow-subtle-lg"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h2 className="text-2xl font-bold text-amber-500 mb-4">List settings</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-white font-semibold mb-1">List name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2 bg-charcoal-900/50 border border-charcoal-700/50 rounded text-white focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <div>
                            <label className="block text-white font-semibold mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-4 py-2 bg-charcoal-900/50 border border-charcoal-700/50 rounded text-white focus:outline-none focus:border-amber-500"
                                rows={2}
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="listIsPublic"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                    className="rounded border-charcoal-600 bg-charcoal-800 text-amber-500 focus:ring-amber-500"
                                />
                                <label htmlFor="listIsPublic" className="text-white">Public</label>
                            </div>
                            <p className="text-white/60 text-sm mt-1">Public: everyone can see. Private: only you and collaborators.</p>
                        </div>

                        <div>
                            <label className="block text-white font-semibold mb-2">Collaborators</label>
                            {loadingCollab ? (
                                <p className="text-white/60 text-sm">Loading...</p>
                            ) : (
                                <ul className="space-y-2 mb-3">
                                    {collaborators.map((c) => (
                                        <li key={c.id} className="flex items-center justify-between py-1 px-2 rounded bg-charcoal-800/50">
                                            <span className="text-white">{c.display_name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-amber-500/80 text-xs uppercase">{c.permission}</span>
                                                {(isOwner || list?.my_permission === 'admin') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCollaborator(c.user_id)}
                                                        className="text-red-400 hover:text-red-300 text-sm"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                    {collaborators.length === 0 && <li className="text-white/50 text-sm">No collaborators yet.</li>}
                                </ul>
                            )}
                            {(isOwner || list?.my_permission === 'admin') && (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            placeholder="Search by username"
                                            className="flex-1 px-3 py-2 bg-charcoal-900/50 border border-charcoal-700/50 rounded text-white text-sm focus:outline-none focus:border-amber-500"
                                        />
                                        <button type="button" onClick={handleSearch} disabled={searching} className="futuristic-button px-3 py-2 text-sm">
                                            {searching ? '...' : 'Search'}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-white/80 text-sm">Permission:</label>
                                        <select
                                            value={addPermission}
                                            onChange={(e) => setAddPermission(e.target.value)}
                                            className="px-2 py-1 bg-charcoal-800 border border-charcoal-600 rounded text-white text-sm"
                                        >
                                            <option value="viewer">Viewer</option>
                                            <option value="editor">Editor</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    {searchResults.length > 0 && (
                                        <ul className="border border-charcoal-600 rounded divide-y divide-charcoal-700 max-h-32 overflow-y-auto">
                                            {searchResults.map((u) => (
                                                <li key={u.id} className="flex items-center justify-between px-3 py-2">
                                                    <span className="text-white text-sm">{u.display_name || u.id}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddCollaborator(u.id)}
                                                        className="text-amber-500 hover:text-amber-400 text-sm"
                                                    >
                                                        Add
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        {saveError && <p className="text-red-400 text-sm">{saveError}</p>}

                        <div className="flex flex-wrap gap-2 pt-2">
                            <button
                                onClick={handleSave}
                                disabled={saveLoading}
                                className="futuristic-button-yellow px-4 py-2 disabled:opacity-50"
                            >
                                {saveLoading ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={onClose} className="futuristic-button px-4 py-2">
                                Cancel
                            </button>
                            {isOwner && (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="ml-auto px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded transition-colors"
                                >
                                    Delete list
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Delete list"
                message={`Are you sure you want to delete "${list?.name}"? This cannot be undone.`}
                confirmText={deleteLoading ? 'Deleting...' : 'Delete'}
                cancelText="Cancel"
                isDanger={true}
            />
        </>
    );
};

export default ListSettingsModal;
