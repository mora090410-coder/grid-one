import React from 'react';
import { Link } from 'react-router-dom';
import { Glass } from '../src/design/primitives';
import { primaryLink } from '../src/features/homepage/sections/cta';
import { ArticleShell } from '../src/features/site';
import { ArticleCTA } from '../components/seo/ArticleCTA';

export const HowToRunSquares: React.FC = () => {
    const title = 'How to Run Super Bowl Squares Online | GridOne';
    const description = 'Learn how to run Super Bowl squares online, share one live board link, and avoid paper-board confusion for fundraisers, offices, and watch parties.';

    return (
        <ArticleShell
            tag="Organizer Playbook"
            title={title}
            heading="How to Run a Super Bowl Squares Pool Online"
            lede="Running a squares pool used to mean passing around a ratty piece of poster board at the office. Today, organizers can build, clean up, and share their boards online without the usual chaos."
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
                    publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icon-512.png' } },
                },
                {
                    '@type': 'HowTo',
                    name: 'How to Run Super Bowl Squares Online',
                    description,
                    step: [
                        { '@type': 'HowToStep', name: 'Build the board', text: 'Create your football squares board, upload a board photo if needed, and clean up names before sharing.' },
                        { '@type': 'HowToStep', name: 'Publish and share', text: 'Publish the board and send one live link to your friends, family, or coworkers.' },
                        { '@type': 'HowToStep', name: 'Draw the numbers', text: 'Randomize the numbers only after all squares are claimed.' },
                        { '@type': 'HowToStep', name: 'Follow results', text: 'Track results by matching the last digit of each team score at the end of each quarter and final.' },
                    ],
                },
            ]}
            aside={
                <>
                    <div className="flex flex-col items-start gap-4">
                        <Link to="/create" className={primaryLink}>
                            Build Your 2026 Board →
                        </Link>
                        <p className="font-ui text-[14px] leading-[1.6] text-fg-3">Create and edit first. Publish when you're ready.</p>
                    </div>

                    <ArticleCTA
                        title="Related guides"
                        links={[
                            { to: '/articles/how-football-squares-work', label: 'How Football Squares Work', primary: true },
                            { to: '/articles/football-squares-fundraiser', label: 'Football squares fundraiser ideas' },
                            { to: '/articles/run-your-pool-alternative', label: 'Compare GridOne to older tools' },
                        ]}
                    />
                </>
            }
        >
            <h2 id="the-basics">The Basics: What is a Football Square?</h2>
            <p>
                A Super Bowl squares board (often called a 'grid' or 'pool') is a 10x10 grid. It creates 100 individual squares. One team is assigned to the Columns (e.g., Kansas City), and the other team is assigned to the Rows (e.g., Philadelphia).
            </p>
            <p>
                The columns and rows are then assigned random numbers from 0 to 9. The matching square is the winner for that scoring milestone under the organizer's published rules.
            </p>

            <Glass padding="lg" className="my-12">
                <h3>Step-by-Step Instructions</h3>

                <div className="flex flex-col gap-8">
                    <div className="flex gap-4">
                        <span className="flex-none font-mono text-[13px] leading-none text-fg-3 pt-1">1</span>
                        <div>
                            <h4 className="font-ui text-[17px] font-semibold text-fg">Build the board</h4>
                            <p>Rather than drawing one by hand, use a digital tool like <strong><Link to="/">GridOne</Link></strong>. Set your teams, upload a background image of your physical board, and review team names, positions, and remove any stray marks before publishing.</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <span className="flex-none font-mono text-[13px] leading-none text-fg-3 pt-1">2</span>
                        <div>
                            <h4 className="font-ui text-[17px] font-semibold text-fg">Unlock and share</h4>
                            <p>Once the board is ready, publish it and send the viewer link to your friends, family, or coworkers. Your first published board is free. Game Day is $9.99 once for up to 5 published boards in the 2026 season. Organization is $79 per season for up to 50 published boards.</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <span className="flex-none font-mono text-[13px] leading-none text-fg-3 pt-1">3</span>
                        <div>
                            <h4 className="font-ui text-[17px] font-semibold text-fg">Draw the numbers</h4>
                            <p>Wait until all squares are claimed before drawing numbers. Draw 0-9 randomly for the top and side. Doing this online keeps the draw clearer for everyone following the board.</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <span className="flex-none font-mono text-[13px] leading-none text-fg-3 pt-1">4</span>
                        <div>
                            <h4 className="font-ui text-[17px] font-semibold text-fg">Watch and win</h4>
                            <p>At the end of Q1, Q2, Q3, and the Final Score, compare the last digit of both teams' scores to your grid. If the Chiefs have 14 and the Eagles have 17, the winning square is (Chiefs 4, Eagles 7).</p>
                        </div>
                    </div>
                </div>
            </Glass>

            <h2 id="digital-vs-paper">Why the "Paper Method" is Dead</h2>
            <p>
                If you've ever organized a pool via email chains, texting pictures of a whiteboard, or forcing people to squint at a low-res image, you know the pain.
            </p>
            <p>
                When you use a purpose-built platform like GridOne, you get a <strong>Live Scenario Engine</strong>. Scores update on their own, and you can enter them yourself anytime. The board can then show everyone, "If this team scores a touchdown next, Linda wins," turning a passive grid into an active watch-party view.
            </p>
        </ArticleShell>
    );
};
