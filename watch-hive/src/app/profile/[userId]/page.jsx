"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import LoadingSpinner from '../../components/LoadingSpinner';
import Link from 'next/link';

export default function PublicProfilePage() {
    const params = useParams();
    const userId = params?.userId;
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        fetch(`/api/users/${userId}/profile`, { credentials: 'include' })
            .then((res) => {
                if (!res.ok) {
                    if (res.status === 404 || res.status === 403) {
                        return res.json().then((d) => {
                            setError(d.error || 'Profile not found');
                            setProfile(null);
                        });
                    }
                    throw new Error('Failed to load profile');
                }
                return res.json();
            })
            .then((data) => {
                if (data && data.id) setProfile(data);
            })
            .catch(() => setError('Failed to load profile'))
            .finally(() => setLoading(false));
    }, [userId]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-16 flex justify-center">
                <LoadingSpinner />
            </div>
        );
    }
    if (error || !profile) {
        return (
            <div className="container mx-auto px-4 py-16 text-center">
                <h1 className="text-2xl font-bold text-white mb-2">{error || 'Profile not found'}</h1>
                <p className="text-white/60 mb-4">This profile may be private or the user may have restricted who can see it.</p>
                <Link href="/" className="text-amber-500 hover:text-amber-400">Back to home</Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <div className="futuristic-card p-6 flex flex-col items-center text-center">
                {profile.avatar_url ? (
                    <img
                        src={profile.avatar_url}
                        alt={profile.display_name || 'User'}
                        className="w-24 h-24 rounded-full object-cover mb-4"
                    />
                ) : (
                    <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                        <span className="text-3xl font-bold text-amber-500">
                            {(profile.display_name || '?').charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}
                <h1 className="text-2xl font-bold text-amber-500">{profile.display_name || 'Unknown'}</h1>
                <p className="text-white/60 mt-2">Profile view. More sections (watched, lists) can be added here.</p>
                <Link href="/" className="mt-4 text-amber-500 hover:text-amber-400">Back to home</Link>
            </div>
        </div>
    );
}
