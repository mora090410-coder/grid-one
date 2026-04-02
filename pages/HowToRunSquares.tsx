import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';

export const HowToRunSquares: React.FC = () => {
    return (
        <div className="min-h-screen bg-background text-white font-sans selection:bg-gold/30 flex flex-col overflow-x-hidden">
            <Header />
            <main className="mx-auto w-full max-w-4xl px-5 py-24 animate-in fade-in slide-in-from-bottom-8 duration-700">

                <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-live ring-1 ring-live/20 backdrop-blur-sm">
                    Organizer Playbook
                </div>

                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl text-white mb-6">
                    How to Run a <span className="text-gold">Super Bowl Squares Pool</span> Online
                </h1>

                <p className="text-xl text-white/70 mb-12 leading-relaxed">
                    Running a squares pool used to mean passing around a ratty piece of poster board at the office. Today, organizers can build, clean up, and share their boards online without the usual chaos.
                </p>

                <article className="prose prose-invert prose-lg max-w-none">

                    <h2 className="text-2xl font-semibold text-white mt-12 mb-6" id="the-basics">The Basics: What is a Football Square?</h2>
                    <p className="text-white/80 leading-relaxed mb-6">
                        A Super Bowl squares board (often called a 'grid' or 'pool') is a 10x10 grid. It creates 100 individual squares. One team is assigned to the Columns (e.g., Kansas City), and the other team is assigned to the Rows (e.g., Philadelphia).
                    </p>
                    <p className="text-white/80 leading-relaxed mb-6">
                        The columns and rows are then assigned random numbers from 0 to 9. The goal? To own the square that intersects with the final digit of both teams' scores at the end of each quarter.
                    </p>

                    <div className="my-12 rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur">
                        <h3 className="text-xl font-bold text-white mb-6">Step-by-Step Instructions</h3>

                        <div className="space-y-8">
                            <div className="flex gap-4">
                                <div className="flex-none flex h-10 w-10 items-center justify-center rounded-full bg-cardinal font-bold text-white shadow-lg">1</div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Build the board</h4>
                                    <p className="mt-2 text-sm text-white/70">Rather than drawing one by hand, use a digital tool like <strong><Link to="/" className="text-gold hover:underline hover:text-white transition-colors">GridOne</Link></strong>. Set your teams, upload a background image of your physical board, and review team names, positions, and remove any stray marks before publishing.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-none flex h-10 w-10 items-center justify-center rounded-full bg-cardinal font-bold text-white shadow-lg">2</div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Unlock and share</h4>
                                    <p className="mt-2 text-sm text-white/70">Once the board is ready, unlock sharing and send the viewer link to your friends, family, or coworkers. They get a clean read-only board with live updates.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-none flex h-10 w-10 items-center justify-center rounded-full bg-cardinal font-bold text-white shadow-lg">3</div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Draw the numbers</h4>
                                    <p className="mt-2 text-sm text-white/70">This is crucial: <em>Wait until all squares are claimed before drawing numbers</em>. Draw numbers 0-9 randomly for the top rows, and 0-9 randomly for the side columns. Doing this online prevents cheating accusations.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-none flex h-10 w-10 items-center justify-center rounded-full bg-gold font-bold text-black shadow-[0_0_15px_rgba(255,199,44,0.3)]">4</div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Watch and win</h4>
                                    <p className="mt-2 text-sm text-white/70">At the end of Q1, Q2, Q3, and the Final Score, compare the last digit of both teams' scores to your grid. If the Chiefs have 14 and the Eagles have 17, the winning square is (Chiefs 4, Eagles 7).</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-2xl font-semibold text-white mt-12 mb-6" id="digital-vs-paper">Why the "Paper Method" is Dead</h2>
                    <p className="text-white/80 leading-relaxed mb-6">
                        If you've ever organized a pool via email chains, texting pictures of a whiteboard, or forcing people to squint at a low-res image, you know the pain.
                    </p>
                    <p className="text-white/80 leading-relaxed mb-6">
                        When you use a purpose-built platform like GridOne, you get a <strong>Live Scenario Engine</strong>. That means when you're watching the game, the grid automatically updates. It will tell everyone, "If the Chiefs score a touchdown next, Linda wins." This feature alone turns a passive game into an active watch party hit.
                    </p>

                    <div className="mt-16 text-center">
                        <Link to="/create" className="inline-flex items-center justify-center gap-2 rounded-full bg-cardinal px-8 py-4 text-lg font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:brightness-110 hover:shadow-lg transition-all active:scale-95">
                            Build Your 2026 Board →
                        </Link>
                        <p className="mt-4 text-sm text-white/50">Create and edit first. Unlock sharing when you're ready.</p>
                    </div>
                </article>
            </main>
        </div>
    );
};
