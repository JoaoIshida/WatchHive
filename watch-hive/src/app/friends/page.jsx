"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect /friends -> /profile/friends
 */
export default function FriendsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/profile/friends');
    }, [router]);
    return null;
}
