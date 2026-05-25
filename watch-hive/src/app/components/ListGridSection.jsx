"use client";

import ListPreviewCard from './ListPreviewCard';

/**
 * Grid of list preview cards (profile, browse). Same layout as public profile lists.
 */
export default function ListGridSection({
    lists = [],
    shared = false,
    badge,
    title,
    icon: Icon,
    sectionTitle = null,
    getNameHighlight,
    getDescriptionHighlight,
    className = 'mb-10',
    gridClassName = 'grid grid-cols-1 sm:grid-cols-2 gap-3',
}) {
    if (!lists.length) return null;

    return (
        <section className={className}>
            {sectionTitle}
            {title && Icon && (
                <div className="mb-4 px-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 font-semibold mb-1">
                        Collection
                    </p>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Icon className="w-5 h-5 text-amber-500" />
                        {title}
                    </h2>
                </div>
            )}
            <div className={gridClassName}>
                {lists.map((list) => (
                    <ListPreviewCard
                        key={list.id}
                        list={list}
                        shared={shared}
                        badge={badge}
                        nameHighlight={getNameHighlight?.(list)}
                        descriptionHighlight={getDescriptionHighlight?.(list)}
                    />
                ))}
            </div>
        </section>
    );
}
