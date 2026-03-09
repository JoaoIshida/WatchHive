"use client";
import { LogOut, Trash2 } from 'lucide-react';

export default function ProfileSettingsSection({
    displayName,
    setDisplayName,
    profileVisibility,
    setProfileVisibility,
    isUpdating,
    setIsUpdating,
    savingVisibility,
    setSavingVisibility,
    checkAuthStatus,
    setShowSignOutModal,
    setShowDeleteModal,
}) {
    return (
        <div className="space-y-6">
            <div className="futuristic-card p-6">
                <h2 className="text-2xl font-bold mb-4 text-amber-500">
                    Profile Settings
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-white font-semibold mb-2">
                            Username
                        </label>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="flex-1 px-4 py-2 bg-charcoal-900/50 border border-charcoal-700/50 rounded text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                                placeholder="Enter your username"
                            />
                            <button
                                onClick={async () => {
                                    if (!displayName.trim()) {
                                        alert('Username cannot be empty');
                                        return;
                                    }
                                    setIsUpdating(true);
                                    try {
                                        const response = await fetch('/api/user/profile', {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({ display_name: displayName.trim() }),
                                        });
                                        if (response.ok) {
                                            await checkAuthStatus();
                                            alert('Username updated successfully!');
                                        } else {
                                            const error = await response.json();
                                            alert(error.error || 'Failed to update username');
                                        }
                                    } catch (error) {
                                        console.error('Error updating display name:', error);
                                        alert('Error updating username');
                                    } finally {
                                        setIsUpdating(false);
                                    }
                                }}
                                disabled={isUpdating}
                                className="futuristic-button-yellow px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUpdating ? 'Updating...' : 'Update'}
                            </button>
                        </div>
                        <p className="text-sm text-amber-500/80 mt-2">
                            This is how your name will appear on your profile
                        </p>
                    </div>
                    <div className="mt-6 pt-4 border-t border-charcoal-700">
                        <label className="block text-white font-semibold mb-2">
                            Who can see my profile
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={profileVisibility}
                                onChange={(e) => setProfileVisibility(e.target.value)}
                                className="px-4 py-2 bg-charcoal-900/50 border border-charcoal-700/50 rounded text-white focus:outline-none focus:border-amber-500"
                            >
                                <option value="anyone">Anyone</option>
                                <option value="friends">Friends only</option>
                                <option value="no_one">No one (private)</option>
                            </select>
                            <button
                                onClick={async () => {
                                    setSavingVisibility(true);
                                    try {
                                        const response = await fetch('/api/user/profile', {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({ profile_visibility: profileVisibility }),
                                        });
                                        if (response.ok) {
                                            await checkAuthStatus();
                                            alert('Visibility updated.');
                                        } else {
                                            const err = await response.json();
                                            alert(err.error || 'Failed to update');
                                        }
                                    } catch (e) {
                                        alert('Failed to update visibility');
                                    } finally {
                                        setSavingVisibility(false);
                                    }
                                }}
                                disabled={savingVisibility}
                                className="futuristic-button-yellow px-4 py-2 disabled:opacity-50"
                            >
                                {savingVisibility ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                        <p className="text-sm text-amber-500/80 mt-2">
                            Controls who can view your profile when they open your profile link.
                        </p>
                    </div>
                </div>
            </div>

            <div className="futuristic-card p-6">
                <h2 className="text-2xl font-bold mb-4 text-amber-500">
                    Account Actions
                </h2>
                <div className="space-y-4">
                    <button
                        onClick={() => setShowSignOutModal(true)}
                        className="w-full futuristic-button px-4 py-3 text-left flex items-center gap-3"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                    </button>
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded transition-colors"
                    >
                        <Trash2 className="w-5 h-5" />
                        <span>Delete Account</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
