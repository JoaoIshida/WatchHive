/**
 * Normalize search input so pasted URLs, %20, +, and double-encoding behave like typed text.
 * Use the same logic on the client (before fetch) and on the API (defense in depth).
 */
export function normalizeSearchQueryInput(raw) {
    if (raw == null) return '';
    let s = String(raw).replace(/\+/g, ' ');
    let guard = 0;
    while (s.includes('%') && guard < 6) {
        const prev = s;
        try {
            s = decodeURIComponent(s);
        } catch {
            s = s.replace(/%20/gi, ' ');
            break;
        }
        if (s === prev) break;
        guard++;
    }
    return s;
}

export function tmdbItemTitleMatchesSubstring(item, normalizedQueryLower) {
    const rawQ = normalizedQueryLower;
    const endsWithSpace = /\s$/.test(rawQ);
    const q = rawQ.trimEnd();
    if (!q) return false;

    const titles = [item.title, item.name, item.original_title, item.original_name]
        .filter(Boolean)
        .map((t) => String(t).toLowerCase());

    if (endsWithSpace) {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}\\b`, 'i');
        return titles.some((t) => re.test(t));
    }

    return titles.some((t) => t.includes(q));
}
