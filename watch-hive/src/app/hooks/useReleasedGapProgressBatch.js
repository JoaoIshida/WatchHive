"use client";
import { useState, useEffect, useMemo } from 'react';
import { seriesPercentFromReleasedCounts } from '../utils/watchProgressHelper';

const BATCH_CHUNK_SIZE = 30;

function mapBatchRow(data) {
    if (!data || data.error) {
        return { ready: true, error: true };
    }
    const count = typeof data.count === 'number' ? data.count : 0;
    const watched = typeof data.watched === 'number' ? data.watched : 0;
    const releasedTotal =
        typeof data.releasedTotal === 'number' ? data.releasedTotal : watched + count;
    const { percentage, total } = seriesPercentFromReleasedCounts(watched, count);
    return {
        ready: true,
        error: false,
        percentage,
        total,
        watched,
        gap: count,
        releasedTotal,
    };
}

async function fetchReleasedGapChunk(ids) {
    const res = await fetch('/api/series-progress/released-gap-counts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesIds: ids }),
    });
    if (!res.ok) {
        return Object.fromEntries(ids.map((id) => [id, { error: true }]));
    }
    return res.json();
}

/**
 * Fetches released-gap progress for multiple series via batch API (chunked).
 * Map values: { ready: false } while loading; { ready: true, percentage, ... } when done.
 */
export function useReleasedGapProgressBatch(seriesIds) {
    const idsKey = useMemo(() => {
        const unique = [...new Set(seriesIds.map((id) => String(id)).filter(Boolean))];
        unique.sort();
        return unique.join(',');
    }, [seriesIds]);

    const [byId, setById] = useState({});
    /** Marking episodes doesn't change the id list, so refetch on the app-wide update event too. */
    const [version, setVersion] = useState(0);
    useEffect(() => {
        const bump = () => setVersion((v) => v + 1);
        window.addEventListener('watchhive-data-updated', bump);
        return () => window.removeEventListener('watchhive-data-updated', bump);
    }, []);

    useEffect(() => {
        const ids = idsKey ? idsKey.split(',') : [];
        if (ids.length === 0) {
            setById({});
            return;
        }

        let cancelled = false;
        setById((prev) => {
            const next = {};
            for (const id of ids) {
                next[id] = prev[id]?.ready === true ? prev[id] : { ready: false };
            }
            return next;
        });

        (async () => {
            try {
                const chunks = [];
                for (let i = 0; i < ids.length; i += BATCH_CHUNK_SIZE) {
                    chunks.push(ids.slice(i, i + BATCH_CHUNK_SIZE));
                }
                const payloads = await Promise.all(chunks.map((chunk) => fetchReleasedGapChunk(chunk)));
                if (cancelled) return;
                const merged = Object.assign({}, ...payloads);
                setById(() => {
                    const next = {};
                    for (const id of ids) {
                        next[id] = mapBatchRow(merged[id]);
                    }
                    return next;
                });
            } catch {
                if (cancelled) return;
                setById(() => {
                    const next = {};
                    for (const id of ids) {
                        next[id] = { ready: true, error: true };
                    }
                    return next;
                });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [idsKey, version]);

    return byId;
}
