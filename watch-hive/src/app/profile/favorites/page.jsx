"use client";
import { useEffect } from 'react';
import { useUserData } from '../../contexts/UserDataContext';
import ProfileFavoritesSection from '../ProfileFavoritesSection';

export default function ProfileFavoritesPage() {
    const {
        favorites,
        favoritesDetails,
        loading,
        userDataHydrated,
        loadingFavoritesDetails,
        loadingProfileEnrichment,
        loadProfileContentEnrichment,
    } = useUserData();

    useEffect(() => {
        if (loading || !userDataHydrated) return;
        void loadProfileContentEnrichment();
    }, [loading, userDataHydrated, loadProfileContentEnrichment]);

    const loadingList =
        loadingFavoritesDetails ||
        (favorites.length > 0 &&
            favoritesDetails.length === 0 &&
            loadingProfileEnrichment);

    return (
        <ProfileFavoritesSection
            loadingFavoritesDetails={loadingList}
            favoritesDetails={favoritesDetails}
        />
    );
}
