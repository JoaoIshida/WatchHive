import Image from 'next/image';
import Link from 'next/link';
import PageStateMessage from './components/PageStateMessage';

export const metadata = {
    title: 'Page not found | WatchHive',
};

export default function NotFound() {
    return (
        <PageStateMessage
            containerClassName="max-w-2xl"
            visual={
                <div className="w-full">
                    <span className="sr-only">404 — page not found</span>
                    {/* “4 cozy 4”: two fours with Beengie as the zero in the middle */}
                    <div
                        className="flex flex-row flex-wrap items-center justify-center gap-x-0.5 gap-y-3 sm:gap-x-1 md:gap-x-1.5"
                        aria-hidden="true"
                    >
                        <span className="text-7xl sm:text-8xl md:text-9xl font-black text-amber-500 tabular-nums leading-none select-none shrink-0">
                            4
                        </span>
                        <div
                            className="relative h-[5.25rem] w-[5.25rem] sm:h-[6.75rem] sm:w-[6.75rem] md:h-[7.75rem] md:w-[7.75rem] rounded-full border-2 border-amber-500/55 bg-charcoal-900/95 shadow-inner shadow-black/40 flex items-center justify-center overflow-hidden ring-2 ring-amber-500/15 shrink-0"
                        >
                            <Image
                                src="/beengie/beengie-cozy.png"
                                alt=""
                                width={240}
                                height={240}
                                className="object-contain w-full h-full scale-100 drop-shadow-md"
                                priority
                            />
                        </div>
                        <span className="text-7xl sm:text-8xl md:text-9xl font-black text-amber-500 tabular-nums leading-none select-none shrink-0">
                            4
                        </span>
                    </div>
                </div>
            }
            title="We couldn’t find that page"
            description="The address may be wrong, the show or movie may have been removed from TMDB, or the link you followed is out of date."
            actions={
                <>
                    <Link href="/" className="futuristic-button-yellow inline-flex justify-center py-3 px-6 text-center">
                        Back home
                    </Link>
                    <Link
                        href="/series"
                        className="futuristic-button inline-flex justify-center py-3 px-6 text-center border-amber-500/30"
                    >
                        Browse series
                    </Link>
                    <Link
                        href="/movies"
                        className="futuristic-button inline-flex justify-center py-3 px-6 text-center border-amber-500/30"
                    >
                        Browse movies
                    </Link>
                </>
            }
        />
    );
}
