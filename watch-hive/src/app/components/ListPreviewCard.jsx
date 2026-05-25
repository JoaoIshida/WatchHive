"use client";

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import ImageWithFallback from './ImageWithFallback';
import { getListIconMeta } from '../utils/listIconHelper';
import { TMDB_POSTER, truncateLabel } from '../utils/socialProfileHelpers';

export function PosterPreviewStack({ posters = [] }) {
    const slots = [0, 1, 2];
    const shown = slots.map((i) => posters[i] ?? null);

    if (shown.every((p) => p === null)) {
        return (
            <div className="flex items-center gap-0.5 h-14 w-20 flex-shrink-0">
                {slots.map((i) => (
                    <div
                        key={i}
                        className="w-8 h-12 rounded-lg bg-charcoal-800 border border-charcoal-700/50 flex-shrink-0"
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="relative flex items-center h-14 w-20 flex-shrink-0">
            {shown.map((path, i) => (
                <div
                    key={i}
                    className="absolute left-0 top-0 w-9 h-14 rounded-lg overflow-hidden border border-charcoal-700/60"
                    style={{ transform: `translateX(${i * 10}px)`, zIndex: 30 - i * 10 }}
                >
                    {path ? (
                        <ImageWithFallback
                            src={TMDB_POSTER(path)}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-charcoal-900" />
                    )}
                </div>
            ))}
        </div>
    );
}

/**
 * Public list row card with overlapping poster preview (profile / browse).
 */
export default function ListPreviewCard({
    list,
    href,
    badge,
    shared = false,
    nameHighlight = null,
    descriptionHighlight = null,
    className = '',
}) {
    const { Icon, className: iconClassName } = getListIconMeta(list, { shared });
    const displayName = truncateLabel(list.name);
    const itemCount = list.items_count ?? 0;
    const linkHref = href ?? `/lists/${list.id}`;

    return (
        <Link
            href={linkHref}
            className={`futuristic-card p-4 flex items-center gap-4 hover:border-amber-500/40 transition-all duration-200 group border border-charcoal-700/40 ${className}`}
        >
            <PosterPreviewStack posters={list.posters} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${iconClassName}`} aria-hidden />
                    <h3
                        className="text-white font-semibold group-hover:text-amber-500 transition-colors shrink-0"
                        title={list.name}
                    >
                        {nameHighlight ?? displayName}
                    </h3>
                    {badge && (
                        <span className="text-[10px] font-bold text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap flex-shrink-0">
                            {badge}
                        </span>
                    )}
                </div>
                {list.description && (
                    <p className="text-white/50 text-sm mt-0.5 line-clamp-2">
                        {descriptionHighlight ?? list.description}
                    </p>
                )}
                <p className="text-white/50 text-sm mt-0.5">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-amber-500/60 flex-shrink-0 transition-colors" />
        </Link>
    );
}
