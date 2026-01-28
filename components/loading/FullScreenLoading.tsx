import React from 'react';

interface FullScreenLoadingProps {
    message?: string;
}

const FullScreenLoading: React.FC<FullScreenLoadingProps> = ({ message }) => {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0B0C0F]">
            <div className="flex flex-col items-center gap-6">
                {/* Branded Loader */}
                <div className="relative h-16 w-16">
                    {/* Ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-white/5" />
                    {/* Spinner */}
                    <div className="absolute inset-0 rounded-full border-4 border-t-[#8F1D2C] border-r-transparent border-b-transparent border-l-transparent animate-spin" />

                    {/* Inner Static Dot */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#FFC72C] shadow-[0_0_12px_rgba(255,199,44,0.4)]" />
                </div>

                {/* Text */}
                <div className="text-white/40 text-xs font-medium tracking-[0.2em] animate-pulse uppercase">
                    {message || 'GRIDONE'}
                </div>
            </div>
        </div>
    );
};

export default FullScreenLoading;
