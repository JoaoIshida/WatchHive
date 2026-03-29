"use client";
import { useEffect } from 'react';
import { useUserData } from '../../contexts/UserDataContext';
import ProfileWishlistSection from '../ProfileWishlistSection';

export default function ProfileWishlistPage() {
    const {
        wishlist,
        wishlistDetails,
        loading,
        loadingWishlistDetails,
        loadingProfileEnrichment,
        loadProfileContentEnrichment,
    } = useUserData();

    useEffect(() => {
        if (loading) return;
        void loadProfileContentEnrichment();
    }, [loading, loadProfileContentEnrichment]);

    const loadingList =
        loadingWishlistDetails ||
        (wishlist.length > 0 &&
            wishlistDetails.length === 0 &&
            loadingProfileEnrichment);

    return (
        <ProfileWishlistSection
            loadingWishlistDetails={loadingList}
            wishlistDetails={wishlistDetails}
        />
    );
}
