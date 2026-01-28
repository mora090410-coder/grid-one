import React from 'react';
import { Share2, Lock, MessageCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';

interface LockedLiveViewProps {
    ownerId?: string | null;
    variant?: 'default' | 'overlay';
}

const LockedLiveView: React.FC<LockedLiveViewProps> = ({ ownerId, variant = 'default' }) => {
    // Get current URL for sharing
    const currentUrl = window.location.href;

    const handleNudge = () => {
        const text = `Hey! Can you activate our Super Bowl board on GridOne? We want to see the live winners! Here is the link: ${currentUrl}`;
        const smsUrl = `sms:&body=${encodeURIComponent(text)}`;
        window.location.href = smsUrl;
    };

    const isOverlay = variant === 'overlay';

    return (
        <div className={`flex flex-col items-center justify-center p-6 text-center relative overflow-hidden rounded-3xl ${isOverlay ? 'w-full h-full' : 'min-h-[50vh] border border-white/10 bg-[#0a0a0a]'}`}>

            {/* Background Blur Effect - Only show in default mode */}
            {!isOverlay && (
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1566577739112-5180d4bf9390?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-10 blur-xl"></div>
            )}

            <div className={`relative z-10 max-w-md mx-auto flex flex-col items-center gap-6 ${isOverlay ? 'scale-110' : ''}`}>

                <div className="w-20 h-20 rounded-full bg-[#1c1c1e] border border-white/10 flex items-center justify-center shadow-2xl">
                    <Lock className="w-8 h-8 text-[#9D2235]" strokeWidth={1.5} />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white drop-shadow-md">Live View Locked</h2>
                    <p className="text-gray-300 text-sm leading-relaxed drop-shadow-md font-medium">
                        This board is awaiting activation. Live winners and "What-if" scenarios will unlock once the organizer activates the board for the group.
                    </p>
                </div>

                <button
                    onClick={handleNudge}
                    className="w-full btn-cardinal py-4 rounded-xl flex items-center justify-center gap-3 shadow-2xl hover:shadow-[#9D2235]/40 group transition-all"
                >
                    <MessageCircle className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                    <span className="font-bold uppercase tracking-widest text-sm">Nudge Organizer to Activate</span>
                </button>

                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                    Premium Feature
                </p>
            </div>
        </div>
    );
};

export default LockedLiveView;
