"use client";
import { useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ProfileFriendsSection from '../ProfileFriendsSection';

export default function ProfileFriendsPage() {
    const { user } = useAuth();
    const friendsFetchRef = useRef(null);

    const onFriendsChanged = async () => {
        try {
            const res = await fetch('/api/friends/pending-count', { credentials: 'include' });
            const data = res.ok ? await res.json() : { count: 0 };
            const count = data?.count ?? 0;
            window.dispatchEvent(new CustomEvent('refreshPendingInvites', { detail: { count } }));
        } catch {
            window.dispatchEvent(new CustomEvent('refreshPendingInvites', { detail: { count: 0 } }));
        }
    };

    return (
        <ProfileFriendsSection
            userId={user?.id}
            fetchFriendsRef={friendsFetchRef}
            onFriendsChanged={onFriendsChanged}
        />
    );
}
