"use client";

const NewReleaseBadge = ({ releaseDate, className = "" }) => {
    if (!releaseDate) return null;

    const release = new Date(releaseDate);
    const now = new Date();
    const daysDiff = Math.floor((now - release) / (1000 * 60 * 60 * 24));

    // Show badge if released within last 7 days
    if (daysDiff >= 0 && daysDiff <= 7) {
        return (
            <div className={`absolute top-1 left-1 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-subtle z-10 ${className}`}>
                NEW
            </div>
        );
    }

    return null;
};

export default NewReleaseBadge;

