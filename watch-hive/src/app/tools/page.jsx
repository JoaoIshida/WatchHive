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
        id: 'coming-soon-1',
        label: 'More tools',
        description: 'Coming soon.',
        href: null,
        available: false,
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
                            <h2 className="text-lg font-semibold text-white">{tool.label}</h2>
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
