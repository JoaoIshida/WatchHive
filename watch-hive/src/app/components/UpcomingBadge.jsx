"use client";

const UpcomingBadge = ({ releaseDate, className = "" }) => {
    if (!releaseDate) return null;

    const release = new Date(releaseDate);
    const now = new Date();
    const daysDiff = Math.floor((release - now) / (1000 * 60 * 60 * 24));

    // Show badge if release date is in the future
    if (daysDiff > 0) {
        return (
            <div className={`absolute top-1 right-1 bg-gray-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow z-10 ${className}`}>
                UPCOMING
            </div>
        );
    }

    return null;
};

export default UpcomingBadge;

