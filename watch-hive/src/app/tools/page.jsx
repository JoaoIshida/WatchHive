"use client";
import React from 'react';
import Link from 'next/link';

const TOOLS_CONFIG = [
    {
        id: 'recommendations',
        label: 'Get Recommendations',
        description: 'Find movies and series similar to titles you like.',
        href: '/recommendations',
        available: true,
    },
    {
        id: 'ai-search',
        label: 'AI Search',
        description: 'Describe what you want to watch — Gemini suggests matching titles.',
        href: '/tools/ai-search',
        available: true,
        badge: 'Beta',
    },
];

const ToolsPage = () => {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <h1 className="text-4xl font-bold text-amber-500 mb-2">Tools</h1>
            <p className="text-white/60 mb-8">
                Quick tools to discover what to watch next.
            </p>
            <div className="space-y-4">
                {TOOLS_CONFIG.map((tool) => (
                    <div
                        key={tool.id}
                        className="futuristic-card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold text-white">{tool.label}</h2>
                                {tool.badge && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/40 px-1.5 py-0.5 rounded">
                                        {tool.badge}
                                    </span>
                                )}
                            </div>
                            <p className="text-white/60 text-sm mt-0.5">{tool.description}</p>
                        </div>
                        <div className="flex-shrink-0">
                            {tool.available ? (
                                <Link
                                    href={tool.href}
                                    className="futuristic-button-yellow text-sm px-4 py-2 inline-block"
                                >
                                    Open
                                </Link>
                            ) : (
                                <span className="text-white/40 text-sm px-4 py-2">Coming soon</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ToolsPage;
