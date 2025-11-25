"use client";

export default function ImageWithFallback({ src, alt, className, fallbackSrc, ...props }) {
    const handleError = (e) => {
        if (fallbackSrc) {
            e.target.src = fallbackSrc;
        } else {
            e.target.src = 'https://via.placeholder.com/500x750?text=No+Image';
        }
    };

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            onError={handleError}
            {...props}
        />
    );
}

