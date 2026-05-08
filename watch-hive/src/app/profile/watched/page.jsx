"use client";
import { useState, useEffect, Suspense } from 'react';
import { useUserData } from '../../contexts/UserDataContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProfileWatchedSection from '../ProfileWatchedSection';

export default function ProfileWatchedPage() {
    const {
        watched,
        watchedDetails,
        loading,
        userDataHydrated,
        loadingWatchedDetails,
        loadingProfileEnrichment,
        loadProfileContentEnrichment,
    } = useUserData();
    const [watchedFilter, setWatchedFilter] = useState('all');

    useEffect(() => {
        if (loading || !userDataHydrated) return;
        void loadProfileContentEnrichment();
    }, [loading, userDataHydrated, loadProfileContentEnrichment]);

    const loadingDetails =
        watched.length > 0 &&
        watchedDetails.length === 0 &&
        (loadingWatchedDetails || loadingProfileEnrichment);

    return (
        <Suspense
            fallback={
                <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" text="Loading…" />
                </div>
            }
        >
            <ProfileWatchedSection
                watchedDetails={watchedDetails}
                watchedFilter={watchedFilter}
                setWatchedFilter={setWatchedFilter}
                loadingDetails={loadingDetails}
            />
        </Suspense>
    );
}
