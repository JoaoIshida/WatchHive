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
                    className={`${sizeClasses[size]} border-4 border-futuristic-blue-700/20 rounded-full`}
                ></div>
                {/* Spinning ring */}
                <div
                    className={`${sizeClasses[size]} border-4 border-transparent border-t-futuristic-yellow-500 border-r-futuristic-yellow-500 rounded-full absolute top-0 left-0 animate-spin-slow`}
                    style={{ animationDuration: '1s' }}
                ></div>
                {/* Inner pulsing dot */}
                <div
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-futuristic-yellow-500 rounded-full animate-pulse-glow shadow-glow-yellow"
                ></div>
            </div>
            {text && (
                <p className="mt-6 text-futuristic-yellow-400 font-semibold animate-pulse text-lg">
                    {text}
                </p>
            )}
        </div>
    );
}

