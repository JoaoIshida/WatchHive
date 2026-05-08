"use client";
import { useEffect, Suspense } from 'react';
import { useUserData } from '../../contexts/UserDataContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProfileWishlistSection from '../ProfileWishlistSection';

export default function ProfileWishlistPage() {
    const {
        wishlist,
        wishlistDetails,
        loading,
        userDataHydrated,
        loadingWishlistDetails,
        loadingProfileEnrichment,
        loadProfileContentEnrichment,
    } = useUserData();

    useEffect(() => {
        if (loading || !userDataHydrated) return;
        void loadProfileContentEnrichment();
    }, [loading, userDataHydrated, loadProfileContentEnrichment]);

    const loadingList =
        loadingWishlistDetails ||
        (wishlist.length > 0 &&
            wishlistDetails.length === 0 &&
            loadingProfileEnrichment);

    return (
        <Suspense
            fallback={
                <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" text="Loading…" />
                </div>
            }
        >
            <ProfileWishlistSection loadingWishlistDetails={loadingList} wishlistDetails={wishlistDetails} />
        </Suspense>
    );
}
