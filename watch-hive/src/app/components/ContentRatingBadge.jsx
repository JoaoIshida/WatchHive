"use client";
import { getCertification } from '../utils/certificationHelper';

export default function ContentRatingBadge({ item, mediaType = 'movie', className = '', size = 'default' }) {
    const certification = getCertification(item, mediaType);
    
    if (!certification) {
        return null;
    }
    
    // Size variants
    const sizeClasses = {
        small: 'px-1.5 py-0.5 text-[10px]',
        default: 'px-3 py-1.5 text-sm',
        large: 'px-4 py-2 text-base',
        xl: 'px-5 py-2.5 text-lg border-2'
    };
    
    // Border width - thinner for small/default, thicker for xl
    const borderClass = size === 'xl' ? 'border-2' : 'border';
    
    const sizeClass = sizeClasses[size] || sizeClasses.default;
    
    return (
        <span className={`inline-flex items-center justify-center ${sizeClass} font-bold rounded ${borderClass} border-futuristic-yellow-500/50 bg-futuristic-blue-800/60 text-futuristic-yellow-400 shadow-glow-yellow ${className}`}>
            {certification}
        </span>
    );
}

