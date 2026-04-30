'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import PageStateMessage from './components/PageStateMessage';

export default function ErrorBoundary({ error, reset }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    const digest = error?.digest;

    return (
        <PageStateMessage
            visual={<AlertCircle className="w-16 h-16 text-amber-500" strokeWidth={1.75} aria-hidden />}
            title="Something went wrong"
            description="We couldn’t finish loading this page. If it keeps happening, try again in a moment or return to the homepage."
            actions={
                <>
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="futuristic-button-yellow inline-flex justify-center py-3 px-6 text-center"
                    >
                        Try again
                    </button>
                    <Link href="/" className="futuristic-button inline-flex justify-center py-3 px-6 text-center border-amber-500/30">
                        Back home
                    </Link>
                </>
            }
            footnote={
                digest ? (
                    <p className="text-xs text-white/45 font-mono pt-2">
                        Reference for support: {digest}
                    </p>
                ) : null
            }
        />
    );
}
