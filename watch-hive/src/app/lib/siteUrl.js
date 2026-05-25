/**
 * Canonical origin for absolute URLs (Open Graph, metadataBase, etc.).
 */
export function getSiteUrl() {
    if (process.env.NEXT_PUBLIC_APP_URL) {
        try {
            return new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
        } catch {
            /* fall through */
        }
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return 'https://whive.vercel.app';
}
