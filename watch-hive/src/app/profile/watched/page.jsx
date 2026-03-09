"use client";
import { useState } from 'react';
import { useUserData } from '../../contexts/UserDataContext';
import ProfileWatchedSection from '../ProfileWatchedSection';

export default function ProfileWatchedPage() {
    const { watchedDetails } = useUserData();
    const [watchedFilter, setWatchedFilter] = useState('all');

    return (
        <ProfileWatchedSection
            watchedDetails={watchedDetails}
            watchedFilter={watchedFilter}
            setWatchedFilter={setWatchedFilter}
        />
    );
}
