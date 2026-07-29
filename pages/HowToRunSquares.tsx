import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { PageMetadata } from '../components/seo/PageMetadata';
import { ArticleCTA } from '../components/seo/ArticleCTA';

export const HowToRunSquares: React.FC = () => {
    const title = 'How to Run Super Bowl Squares Online | GridOne';
    const description = 'Learn how to run Super Bowl squares online, share one live board link, and avoid paper-board confusion for fundraisers, offices, and watch parties.';

    return (
        <div className="oa-root min-h-screen bg-broadcast-white text-ink font-sans selection:bg-gold/30 flex flex-col overflow-x-hidden">
            <PageMetadata
                title={title}
                description={description}
                path="/articles/how-to-run-super-bowl-squares"
                type="article"
                schema={[
                    {
                        '@type': 'Article',
                        headline: title,
                        description,
                        mainEntityOfPage: 'https://www.getgridone.com/articles/how-to-run-super-bowl-squares',
                        author: { '@type': 'Organization', name: 'GridOne' },
                        publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icons/gridone-icon-256.png' } },
                    },
                    {
                        '@type': 'HowTo',
                        name: 'How to Run Super Bowl Squares Online',
                        description,
                        step: [
                            { '@type': 'HowToStep', name: 'Build the board', text: 'Create your football squares board, upload a board photo if needed, and clean up names before sharing.' },
                            { '@type': 'HowToStep', name: 'Unlock and share', text: 'Unlock sharing and send one live board link to your friends, family, or coworkers.' },
                            { '@type': 'HowToStep', name: 'Draw the numbers', text: 'Randomize the numbers only after all squares are claimed.' },
                            { '@type': 'HowToStep', name: 'Watch and win', text: 'Track winners by matching the last digit of each team score at the end of each quarter and final.' },
                        ],
                    },
                ]}
            />
            <Header />
            <main className="mx-auto w-full max-w-4xl px-5 py-24 duration-700">

                <div className="mb-8 inline-flex items-center gap-2 rounded-none bg-newsprint px-3 py-1 text-xs text-cardinal ring-1 ring-cardinal">
                    Organizer Playbook
                </div>

                <h1 className="oa-chyron text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl text-ink mb-6">
                    How to Run a <span className="text-gold">Super Bowl Squares Pool</span> Online
                </h1>

                <p className="text-xl text-ink/70 mb-12 leading-relaxed">
                    Running a squares pool used to mean passing around a ratty piece of poster board at the office. Today, organizers can build, clean up, and share their boards online without the usual chaos.
                </p>

                <article className="prose prose-lg max-w-none">

                    <h2 className="oa-headline text-2xl font-semibold text-ink mt-12 mb-6" id="the-basics">The Basics: What is a Football Square?</h2>
                    <p className="text-ink/80 leading-relaxed mb-6">
                        A Super Bowl squares board (often called a 'grid' or 'pool') is a 10x10 grid. It creates 100 individual squares. One team is assigned to the Columns (e.g., Kansas City), and the other team is assigned to the Rows (e.g., Philadelphia).
                    </p>
                    <p className="text-ink/80 leading-relaxed mb-6">
                        The columns and rows are then assigned random numbers from 0 to 9. The goal? To own the square that intersects with the final digit of both teams' scores at the end of each quarter.
                    </p>

                    <div className="my-12 rounded-none bg-newsprint p-8 ring-1 ring-white/10">
                        <h3 className="text-xl font-bold text-ink mb-6">Step-by-Step Instructions</h3>

                        <div className="space-y-8">
                            <div className="flex gap-4">
                                <div className="flex-none flex h-10 w-10 items-center justify-center rounded-none bg-cardinal font-bold text-broadcast-white">1</div>
                                <div>
                                    <h4 className="text-lg font-semibold text-ink">Build the board</h4>
                                    <p className="mt-2 text-sm text-ink/70">Rather than drawing one by hand, use a digital tool like <strong><Link to="/" className="text-gold hover:underline hover:text-ink transition-colors">GridOne</Link></strong>. Set your teams, upload a background image of your physical board, and review team names, positions, and remove any stray marks before publishing.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-none flex h-10 w-10 items-center justify-center rounded-none bg-cardinal font-bold text-broadcast-white">2</div>
                                <div>
                                    <h4 className="text-lg font-semibold text-ink">Unlock and share</h4>
                                    <p className="mt-2 text-sm text-ink/70">Once the board is ready, unlock sharing and send the viewer link to your friends, family, or coworkers. The $4.99 introductory 2026 season pass unlocks up to 20 boards, and viewers get a clean read-only board.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-none flex h-10 w-10 items-center justify-center rounded-none bg-cardinal font-bold text-broadcast-white">3</div>
                                <div>
                                    <h4 className="text-lg font-semibold text-ink">Draw the numbers</h4>
                                    <p className="mt-2 text-sm text-ink/70">This is crucial: <em>Wait until all squares are claimed before drawing numbers</em>. Draw numbers 0-9 randomly for the top rows, and 0-9 randomly for the side columns. Doing this online prevents cheating accusations.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-none flex h-10 w-10 items-center justify-center rounded-none bg-gold font-bold text-ink">4</div>
                                <div>
                                    <h4 className="text-lg font-semibold text-ink">Watch and win</h4>
                                    <p className="mt-2 text-sm text-ink/70">At the end of Q1, Q2, Q3, and the Final Score, compare the last digit of both teams' scores to your grid. If the Chiefs have 14 and the Eagles have 17, the winning square is (Chiefs 4, Eagles 7).</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h2 className="oa-headline text-2xl font-semibold text-ink mt-12 mb-6" id="digital-vs-paper">Why the "Paper Method" is Dead</h2>
                    <p className="text-ink/80 leading-relaxed mb-6">
                        If you've ever organized a pool via email chains, texting pictures of a whiteboard, or forcing people to squint at a low-res image, you know the pain.
                    </p>
                    <p className="text-ink/80 leading-relaxed mb-6">
                        When you use a purpose-built platform like GridOne, you get a <strong>Live Scenario Engine</strong>. Automatic beta score checks can update the grid, while the organizer always has a manual fallback. The board can then show everyone, "If this team scores a touchdown next, Linda wins," turning a passive grid into an active watch-party view.
                    </p>

                    <div className="mt-16 text-center">
                        <Link to="/create" className="inline-flex items-center justify-center gap-2 rounded-none bg-cardinal px-8 py-4 text-lg font-semibold text-broadcast-white hover:bg-cardinal-deep transition-all active:scale-95">
                            Build Your 2026 Board →
                        </Link>
                        <p className="mt-4 text-sm text-ink/50">Create and edit first. Unlock sharing when you're ready.</p>
                    </div>

                    <ArticleCTA
                        title="Related guides"
                        links={[
                            { to: '/articles/how-football-squares-work', label: 'How Football Squares Work', primary: true },
                            { to: '/articles/football-squares-fundraiser', label: 'Football squares fundraiser ideas' },
                            { to: '/articles/run-your-pool-alternative', label: 'Compare GridOne to older tools' },
                        ]}
                    />
                </article>
            </main>
        </div>
    );
};
