/** Shared shell for 404 / error UI (futuristic-card, amber accents). */
export default function PageStateMessage({ visual, title, description, actions, footnote, containerClassName }) {
    return (
        <div className={`container mx-auto px-4 py-12 md:py-20 ${containerClassName ?? 'max-w-lg'}`}>
            <div className="futuristic-card p-8 md:p-12 text-center space-y-8 border-amber-500/25 shadow-subtle-lg">
                {visual != null ? <div className="flex justify-center">{visual}</div> : null}
                <div className="space-y-3">
                    <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
                    <p className="text-white/65 text-base leading-relaxed">{description}</p>
                </div>
                {actions ? (
                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
                        {actions}
                    </div>
                ) : null}
                {footnote}
            </div>
        </div>
    );
}
