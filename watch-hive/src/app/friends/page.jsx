"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Friends are now managed on the profile page (Friends tab).
 * Redirect /friends -> /profile?tab=friends
 */
export default function FriendsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/profile?tab=friends');
    }, [router]);
    return null;
}
