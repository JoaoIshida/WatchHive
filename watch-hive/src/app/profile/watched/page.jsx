"use client";
import { useState, useEffect } from 'react';
import { useUserData } from '../../contexts/UserDataContext';
import ProfileWatchedSection from '../ProfileWatchedSection';

export default function ProfileWatchedPage() {
    const {
        watched,
        watchedDetails,
        loading,
        loadingWatchedDetails,
        loadingProfileEnrichment,
        loadProfileContentEnrichment,
    } = useUserData();
    const [watchedFilter, setWatchedFilter] = useState('all');

    useEffect(() => {
        if (loading) return;
        void loadProfileContentEnrichment();
    }, [loading, loadProfileContentEnrichment]);

    const loadingDetails =
        watched.length > 0 &&
        watchedDetails.length === 0 &&
        (loadingWatchedDetails || loadingProfileEnrichment);

    return (
        <ProfileWatchedSection
            watchedDetails={watchedDetails}
            watchedFilter={watchedFilter}
            setWatchedFilter={setWatchedFilter}
            loadingDetails={loadingDetails}
        />
    );
}
