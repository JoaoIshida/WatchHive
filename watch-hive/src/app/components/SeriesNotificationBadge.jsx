"use client";
import { useState, useEffect } from 'react';

const SeriesNotificationBadge = ({ seriesId, lastAirDate, status, numberOfSeasons, className = "" }) => {
    const [hasNotification, setHasNotification] = useState(false);

    useEffect(() => {
        // Check if series has notifications
        let shouldNotify = false;

        // Check if new season is available (last air date is recent)
        if (lastAirDate) {
            // Parse YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') is UTC midnight).
            const [y, m, d] = String(lastAirDate).slice(0, 10).split('-').map(Number);
            const lastAir = new Date(y, m - 1, d);
            const now = new Date();
            const daysSinceLastAir = Math.floor((now - lastAir) / (1000 * 60 * 60 * 24));
            
            // Notify if new episode aired in last 7 days
            if (daysSinceLastAir >= 0 && daysSinceLastAir <= 7) {
                shouldNotify = true;
            }
        }

        setHasNotification(shouldNotify);
    }, [lastAirDate, status, numberOfSeasons]);

    if (!hasNotification) return null;

    return (
        <div className={`absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-subtle z-10 flex items-center justify-center w-4 h-4 ${className}`} title="New episodes or season available">
            <span className="text-[8px]">!</span>
        </div>
    );
};

export default SeriesNotificationBadge;

