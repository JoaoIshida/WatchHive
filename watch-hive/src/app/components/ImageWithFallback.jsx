"use client";

export default function ImageWithFallback({ src, alt, className, fallbackSrc, ...props }) {
    const defaultFallback = '/no-image.png';
    
    const handleError = (e) => {
        // Prevent infinite loop if fallback also fails
        if (e.target.src === defaultFallback || e.target.src.includes('no-image.png')) {
            return;
        }
        
        if (fallbackSrc) {
            e.target.src = fallbackSrc;
        } else {
            e.target.src = defaultFallback;
        }
    };

    // If no src provided, use fallback directly
    const imageSrc = src || fallbackSrc || defaultFallback;

    return (
        <img
            src={imageSrc}
            alt={alt}
            className={className}
            onError={handleError}
            {...props}
        />
    );
}

