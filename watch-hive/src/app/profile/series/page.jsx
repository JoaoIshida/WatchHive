"use client";
import { useState } from 'react';
import { useUserData } from '../../contexts/UserDataContext';
import ProfileSeriesSection from '../ProfileSeriesSection';

export default function ProfileSeriesPage() {
    const { seriesProgress, seriesDetails } = useUserData();
    const [expandedSeries, setExpandedSeries] = useState({});
    const [seriesSeasonDetails, setSeriesSeasonDetails] = useState({});

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
