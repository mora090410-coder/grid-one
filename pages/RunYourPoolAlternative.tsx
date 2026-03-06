import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';

export const RunYourPoolAlternative: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#060607] text-white font-sans selection:bg-[#FFC72C]/30 flex flex-col overflow-x-hidden">
            <Header />
            <main className="mx-auto w-full max-w-4xl px-5 py-24 animate-in fade-in slide-in-from-bottom-8 duration-700">

                <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-[#FFC72C] ring-1 ring-[#FFC72C]/20 backdrop-blur-sm">
                    Comparison Guide
                </div>

                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl text-white mb-6">
                    The Best Free <span className="text-[#8F1D2C]">RunYourPool Alternative</span> for 2026
                </h1>

                <p className="text-xl text-white/70 mb-12 leading-relaxed">
                    If you're tired of clunky interfaces, delayed score updates, and platforms that look like they were built in 2004, you're not alone. Welcome to the modern way to run sports squares.
                </p>

                <article className="prose prose-invert prose-lg max-w-none">
                    <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Why switch from RunYourPool?</h2>
                    <p className="text-white/80 leading-relaxed mb-6">
                        For years, organizers have defaulted to legacy platforms like RunYourPool out of habit. But as mobile usage has taken over, these older platforms struggle to provide a clean, modern viewer experience on phones. GridOne was built specifically to solve the biggest headaches organizers face during the Super Bowl and NFL playoffs.
                    </p>

                    <div className="my-12 grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-[#FFC72C]/20">
                            <h3 className="text-xl font-bold text-[#FFC72C] mb-4">GridOne (The Modern Way)</h3>
                            <ul className="space-y-3 text-sm text-white/80">
                                <li className="flex items-center gap-2">✓ <strong>100% Free</strong> for basic boards and unlimited viewers</li>
                                <li className="flex items-center gap-2">✓ <strong>Live Scoring:</strong> Updates instantly on every device</li>
                                <li className="flex items-center gap-2">✓ <strong>Scenario Engine:</strong> "If KC scores a TD, who wins?"</li>
                                <li className="flex items-center gap-2">✓ <strong>Mobile-First:</strong> Beautiful 'liquid glass' UI on phones</li>
                                <li className="flex items-center gap-2">✓ <strong>No Login Required</strong> for players to view the board</li>
                            </ul>
                        </div>

                        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 opacity-70">
                            <h3 className="text-xl font-bold text-white/80 mb-4">Legacy Platforms</h3>
                            <ul className="space-y-3 text-sm text-white/60">
                                <li className="flex items-center gap-2">✗ Often charge fees or have hidden costs</li>
                                <li className="flex items-center gap-2">✗ Manual score entry or delayed automated updates</li>
                                <li className="flex items-center gap-2">✗ Cannot calculate complex future "what-if" scenarios</li>
                                <li className="flex items-center gap-2">✗ Desktop-era interfaces that require pinching to zoom</li>
                                <li className="flex items-center gap-2">✗ Often force users to create accounts just to look</li>
                            </ul>
                        </div>
                    </div>

                    <h2 className="text-2xl font-semibold text-white mt-12 mb-6">The Real-Time Scenario Engine</h2>
                    <p className="text-white/80 leading-relaxed mb-6">
                        The biggest differentiator between GridOne and every other RunYourPool alternative is the <strong>Live Scenario Engine</strong>. When you're watching the big game in the 4th quarter, everyone is asking: <em>"Who wins if they kick a field goal here?"</em>
                    </p>
                    <p className="text-white/80 leading-relaxed mb-8">
                        GridOne answers this instantly. It sits next to the live scoreboard, completely eliminating the need to manually cross-reference the grid axis.
                    </p>

                    <div className="mt-16 text-center">
                        <Link to="/create" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8F1D2C] px-8 py-4 text-lg font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:brightness-110 hover:shadow-lg transition-all active:scale-95">
                            Create Your Free Board Now →
                        </Link>
                        <p className="mt-4 text-sm text-white/50">No credit card required. Takes 30 seconds.</p>
                    </div>
                </article>
            </main>
        </div>
    );
};
