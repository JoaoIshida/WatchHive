"use client";
import { useState, useEffect } from 'react';
import { useUserData } from '../../contexts/UserDataContext';
import ProfileSeriesSection from '../ProfileSeriesSection';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ProfileSeriesPage() {
    const {
        seriesProgress,
        seriesDetails,
        loading,
        userDataHydrated,
        loadingProfileEnrichment,
        loadProfileContentEnrichment,
    } = useUserData();
    const [expandedSeries, setExpandedSeries] = useState({});
    const [seriesSeasonDetails, setSeriesSeasonDetails] = useState({});

    useEffect(() => {
        if (loading || !userDataHydrated) return;
        void loadProfileContentEnrichment();
    }, [loading, userDataHydrated, loadProfileContentEnrichment]);

    const hasProgress = Object.keys(seriesProgress).length > 0;
    const waitingForSeriesDetails =
        hasProgress &&
        Object.keys(seriesDetails).length === 0 &&
        loadingProfileEnrichment;

    if (waitingForSeriesDetails) {
        return (
            <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading series…" />
            </div>
        );
    }

    return (
        <ProfileSeriesSection
            seriesProgress={seriesProgress}
            seriesDetails={seriesDetails}
            expandedSeries={expandedSeries}
            setExpandedSeries={setExpandedSeries}
            seriesSeasonDetails={seriesSeasonDetails}
            setSeriesSeasonDetails={setSeriesSeasonDetails}
        />
    );
}
