import React from 'react';

interface FullScreenLoadingProps {
    message?: string;
}

const FullScreenLoading: React.FC<FullScreenLoadingProps> = ({ message }) => {
    return (
        <div className="oa-root fixed inset-0 z-[9999] flex items-center justify-center bg-broadcast-white">
            <div className="flex flex-col items-center gap-6">
                {/* Branded Loader — hard square spinner, no glow */}
                <div className="relative h-16 w-16">
                    {/* Ring */}
                    <div className="absolute inset-0 border-4 border-newsprint" />
                    {/* Spinner */}
                    <div className="absolute inset-0 border-4 border-t-cardinal border-r-transparent border-b-transparent border-l-transparent animate-spin" />

                    {/* Inner Static Dot */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gold" />
                </div>

                {/* Text */}
                <div className="oa-slab text-ink/50 animate-pulse">
                    {message || 'GRIDONE'}
                </div>
            </div>
        </div>
    );
};

export default FullScreenLoading;
