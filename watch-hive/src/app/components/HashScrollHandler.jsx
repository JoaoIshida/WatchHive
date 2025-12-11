"use client";
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function HashScrollHandler() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Wait for page to fully load
        const handleScroll = () => {
            const hash = window.location.hash;
            if (hash) {
                const elementId = hash.substring(1); // Remove the #
                const element = document.getElementById(elementId);
                if (element) {
                    // Use setTimeout to ensure DOM is ready
                    setTimeout(() => {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                }
            }
        };

        // Try immediately
        handleScroll();

        // Also try after a short delay in case content is still loading
        const timeoutId = setTimeout(handleScroll, 300);

        return () => clearTimeout(timeoutId);
    }, [pathname, searchParams]);

    return null;
}

