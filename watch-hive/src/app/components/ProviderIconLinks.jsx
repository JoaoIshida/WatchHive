"use client";

import { useRef, useState } from "react";
import {
    getProviderWatchUrl,
    isAllowedProviderOutboundUrl,
    isProviderNativeSearchUrl,
} from "../utils/watchProviderUrls";

/**
 * @param {object} props
 * @param {Array<{ tmdb_provider_id: number, provider_name: string, logo_path: string | null, canonical_url?: string, openFallbackUrl?: string, tmdbAvailability?: 'flatrate'|'rent'|'buy'|'ads'|'free'|'tve' }>} props.links
 * @param {string} [props.className]
 * @param {string} [props.iconWrapperClass]
 * @param {{ mediaType: 'movie'|'tv', tmdbId: string|number, region: string, tmdbAvailability?: string }} [props.lazyWatchmode] When set, Watchmode is fetched only on click if there is no solid TMDB deeplink; `tmdbAvailability` filters Watchmode source `type` (flatrate→sub, etc.).
 */
export default function ProviderIconLinks({ links, className = "", iconWrapperClass = "", lazyWatchmode = null }) {
    const [loadingPid, setLoadingPid] = useState(null);
    const busyRef = useRef(new Set());

    if (!Array.isArray(links) || links.length === 0) return null;

    const hasOuterSize = Boolean(iconWrapperClass.trim());
    const sizeClass = hasOuterSize ? "" : "h-10 w-10";
    const base = `flex ${sizeClass} items-center justify-center rounded-md border border-amber-500/25 bg-charcoal-800/70 transition-colors`.trim();
    const logoImgClass = hasOuterSize ? "h-10 w-10 object-contain" : "h-8 w-8 object-contain";
    /** TMDB logo_sizes: w45, w92, w154, … — use w92 / w154 for crisp icons at these CSS sizes */
    const logoTmdbSize = hasOuterSize ? "w154" : "w92";
    const active = "hover:border-amber-400/50 hover:bg-charcoal-700/90";
    const disabled = "opacity-35 cursor-not-allowed pointer-events-none";

    const hasSolidDeeplink = (u) => {
        const s = String(u || "").trim();
        return (
            /^https?:\/\//i.test(s) &&
            isAllowedProviderOutboundUrl(s) &&
            !isProviderNativeSearchUrl(s)
        );
    };

    const fallbackForRow = (row) => {
        if (typeof row.openFallbackUrl === "string" && /^https?:\/\//i.test(row.openFallbackUrl.trim())) {
            return row.openFallbackUrl.trim();
        }
        return getProviderWatchUrl(row.tmdb_provider_id, row.provider_name, {}, {});
    };

    const openLazy = async (row) => {
        const pid = row.tmdb_provider_id;
        const availability = String(
            row.tmdbAvailability || lazyWatchmode?.tmdbAvailability || ""
        ).trim();
        const busyKey = `${pid}:${availability || "default"}`;
        if (busyRef.current.has(busyKey)) return;
        busyRef.current.add(busyKey);
        setLoadingPid(busyKey);
        try {
            let openUrl = "";
            if (lazyWatchmode?.mediaType && lazyWatchmode?.tmdbId != null) {
                const qs = new URLSearchParams({
                    mediaType: lazyWatchmode.mediaType === "tv" ? "tv" : "movie",
                    tmdbId: String(lazyWatchmode.tmdbId),
                    region: String(lazyWatchmode.region || "CA").trim().toUpperCase() || "CA",
                    tmdbProviderId: String(pid),
                    providerName: row.provider_name || "",
                });
                if (availability) qs.set("availability", availability.toLowerCase());
                const res = await fetch(`/api/watch/watchmode-resolve?${qs.toString()}`);
                const data = res.ok ? await res.json() : {};
                const wm = typeof data?.url === "string" ? data.url.trim() : "";
                if (wm && isAllowedProviderOutboundUrl(wm) && !isProviderNativeSearchUrl(wm)) {
                    openUrl = wm;
                }
            }
            if (!openUrl) openUrl = fallbackForRow(row);
            if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
        } finally {
            busyRef.current.delete(busyKey);
            setLoadingPid(null);
        }
    };

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
            {links.map((row) => {
                const solid = hasSolidDeeplink(row.canonical_url);
                const fb = fallbackForRow(row);
                const canOpen = solid || !!lazyWatchmode || !!fb;
                const label = row.provider_name || row.provider || "Watch";
                const title = solid ? `${label} — open` : label;

                const inner =
                    row.logo_path ? (
                        <img
                            src={`https://image.tmdb.org/t/p/${logoTmdbSize}${row.logo_path}`}
                            alt=""
                            className={logoImgClass}
                            loading="lazy"
                        />
                    ) : (
                        <span className="text-[9px] text-amber-400/90 px-0.5 text-center leading-tight">
                            {(row.provider_name || row.provider || "?").slice(0, 3)}
                        </span>
                    );

                const rowAvail = String(row.tmdbAvailability || lazyWatchmode?.tmdbAvailability || "").trim();
                const rowKey = `${row.tmdb_provider_id}-${rowAvail || "na"}-${row.provider || ""}`;

                if (!canOpen) {
                    return (
                        <span
                            key={rowKey}
                            className={`${base} ${disabled} ${iconWrapperClass}`}
                            title={title}
                            aria-disabled="true"
                            role="img"
                        >
                            {inner}
                        </span>
                    );
                }

                if (solid) {
                    return (
                        <a
                            key={rowKey}
                            href={String(row.canonical_url).trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${base} ${active} ${iconWrapperClass}`}
                            title={title}
                        >
                            {inner}
                        </a>
                    );
                }

                if (lazyWatchmode) {
                    const busyKey = `${row.tmdb_provider_id}:${String(row.tmdbAvailability || lazyWatchmode?.tmdbAvailability || "").trim() || "default"}`;
                    const busy = loadingPid === busyKey;
                    return (
                        <button
                            key={rowKey}
                            type="button"
                            disabled={busy}
                            onClick={() => openLazy(row)}
                            className={`${base} ${active} ${iconWrapperClass} ${busy ? "opacity-60 cursor-wait" : ""}`}
                            title={title}
                            aria-label={title}
                        >
                            {inner}
                        </button>
                    );
                }

                return (
                    <a
                        key={rowKey}
                        href={fb}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${base} ${active} ${iconWrapperClass}`}
                        title={title}
                    >
                        {inner}
                    </a>
                );
            })}
        </div>
    );
}
