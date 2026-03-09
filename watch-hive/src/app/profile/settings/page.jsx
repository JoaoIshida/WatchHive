"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import ProfileSettingsSection from '../ProfileSettingsSection';
import ConfirmationModal from '../../components/ConfirmationModal';

export default function ProfileSettingsPage() {
    const { user, signOut, checkAuthStatus } = useAuth();
    const router = useRouter();

    const [displayName, setDisplayName] = useState('');
    const [profileVisibility, setProfileVisibility] = useState('anyone');
    const [isUpdating, setIsUpdating] = useState(false);
    const [savingVisibility, setSavingVisibility] = useState(false);
    const [showSignOutModal, setShowSignOutModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || user.email || '');
            if (user.profile_visibility) setProfileVisibility(user.profile_visibility);
        }
    }, [user]);

    return (
        <>
            <ProfileSettingsSection
                displayName={displayName}
                setDisplayName={setDisplayName}
                profileVisibility={profileVisibility}
                setProfileVisibility={setProfileVisibility}
                isUpdating={isUpdating}
                setIsUpdating={setIsUpdating}
                savingVisibility={savingVisibility}
                setSavingVisibility={setSavingVisibility}
                checkAuthStatus={checkAuthStatus}
                setShowSignOutModal={setShowSignOutModal}
                setShowDeleteModal={setShowDeleteModal}
            />
            <ConfirmationModal
                isOpen={showSignOutModal}
                onClose={() => setShowSignOutModal(false)}
                onConfirm={async () => {
                    setShowSignOutModal(false);
                    await signOut();
                    router.push('/');
                    router.refresh();
                }}
                title="Sign Out"
                message="Are you sure you want to sign out?"
                confirmText="Sign Out"
                cancelText="Cancel"
            />
            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={async () => {
                    setShowDeleteModal(false);
                    setIsDeleting(true);
                    try {
                        const response = await fetch('/api/user/delete', {
                            method: 'DELETE',
                            credentials: 'include',
                        });
                        if (response.ok) {
                            await signOut();
                            router.push('/');
                            router.refresh();
                            alert('Your account has been deleted successfully.');
                        } else {
                            const error = await response.json();
                            alert(error.error || 'Failed to delete account');
                        }
                    } catch (error) {
                        console.error('Error deleting account:', error);
                        alert('Error deleting account');
                    } finally {
                        setIsDeleting(false);
                    }
                }}
                title="Delete Account"
                message="Are you sure you want to delete your account? This action cannot be undone. All your data including watched content, wishlist, and lists will be permanently deleted."
                confirmText="Delete Account"
                cancelText="Cancel"
                isDanger={true}
            />
        </>
    );
}
