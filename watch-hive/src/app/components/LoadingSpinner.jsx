"use client";

export default function LoadingSpinner({ size = "md", text = "Loading..." }) {
    const sizeClasses = {
        sm: "w-8 h-8",
        md: "w-12 h-12",
        lg: "w-16 h-16",
    };

    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
                {/* Outer ring */}
                <div
                    className={`${sizeClasses[size]} border-4 border-charcoal-700/20 rounded-full`}
                ></div>
                {/* Spinning ring */}
                <div
                    className={`${sizeClasses[size]} border-4 border-transparent border-t-amber-500 border-r-amber-500 rounded-full absolute top-0 left-0 animate-spin-slow`}
                    style={{ animationDuration: '1s' }}
                ></div>
            </div>
            {text && (
                <p className="mt-6 text-amber-400 font-semibold animate-pulse text-lg">
                    {text}
                </p>
            )}
        </div>
    );
}

