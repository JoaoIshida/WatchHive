'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** @param {import('next/navigation').ReadonlyURLSearchParams} searchParams */
export function parsePageParam(searchParams, key = 'page') {
    const raw = searchParams.get(key);
    if (raw === null || raw === '') return 1;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, 10_000);
}

/**
 * @param {import('next/navigation').ReadonlyURLSearchParams} searchParams
 * @param {string[]} allowed
 * @param {string} defaultSort
 */
export function parseSortParam(searchParams, allowed, defaultSort) {
    const s = searchParams.get('sort');
    if (s && allowed.includes(s)) return s;
    return defaultSort;
}

export function useReplaceQuery() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const replaceParams = useCallback(
        (mutator) => {
            const next = new URLSearchParams(searchParams.toString());
            mutator(next);
            const qs = next.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        },
        [pathname, router, searchParams]
    );

    return { replaceParams, searchParams, pathname };
}
