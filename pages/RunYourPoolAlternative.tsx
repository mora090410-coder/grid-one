import React from 'react';
import { Link } from 'react-router-dom';
import { Glass } from '../src/design/primitives';
import { primaryLink } from '../src/features/homepage/sections/cta';
import { ArticleShell } from '../src/features/site';
import { ArticleCTA } from '../components/seo/ArticleCTA';

export const RunYourPoolAlternative: React.FC = () => {
    const title = 'RunYourPool Alternative for Football Squares | GridOne';
    const description = 'Compare GridOne with broader pool platforms when you mainly need a football-squares board, readable mobile viewing, and one share link.';

    return (
        <ArticleShell
            tag="Comparison Guide"
            title={title}
            heading="A focused RunYourPool alternative for football squares"
            lede="If your group mainly needs one readable football-squares board link, a focused tool may fit better than a broad pool platform."
            description={description}
            path="/articles/run-your-pool-alternative"
            type="article"
            schema={{
                '@type': 'Article',
                headline: title,
                description,
                mainEntityOfPage: 'https://www.getgridone.com/articles/run-your-pool-alternative',
                author: { '@type': 'Organization', name: 'GridOne' },
                publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icon-512.png' } },
                mainEntity: [
                    {
                        '@type': 'Question',
                        name: 'What is the best RunYourPool alternative for football squares?',
                        acceptedAnswer: { '@type': 'Answer', text: 'The best RunYourPool alternative depends on the pool you are running. GridOne is built for football squares organizers who want a mobile-first board, live scoring, simple sharing, and no account requirement for players viewing the board.' },
                    },
                    {
                        '@type': 'Question',
                        name: 'Can players view a GridOne football squares board without logging in?',
                        acceptedAnswer: { '@type': 'Answer', text: 'Yes. Players can open a shared GridOne board link without creating an account, which makes it easier to share a football squares board with friends, coworkers, parents, or supporters.' },
                    },
                ],
            }}
            aside={
                <>
                    <div className="flex flex-col items-start gap-4">
                        <Link to="/create" className={primaryLink}>
                            Create your free board
                        </Link>
                        <p className="font-ui text-[14px] leading-[1.6] text-fg-3">Your first published board is free. Game Day is $9.99 once for up to 5 published boards in the 2026 season. Organization is $79 per season for up to 50 published boards.</p>
                    </div>

                    <ArticleCTA
                        title="Related guides"
                        links={[
                            { to: '/articles/digital-football-squares-board-vs-paper', label: 'Digital vs Paper Board', primary: true },
                            { to: '/articles/how-to-run-super-bowl-squares', label: 'How to run Super Bowl squares' },
                            { to: '/articles/football-squares-fundraiser', label: 'Fundraiser use cases' },
                        ]}
                    />
                </>
            }
        >
            <h2>When a focused board fits better</h2>
            <p>
                Broader pool platforms support many formats. GridOne stays focused on football squares: the organizer builds one board, shares one link, and viewers follow it without creating accounts.
            </p>

            <div className="my-12 grid gap-6 md:grid-cols-2">
                <Glass padding="lg">
                    <h3>GridOne for football squares</h3>
                    <ul className="[&>li]:list-none">
                        <li>✓ <strong>Free to build</strong> your board before you publish</li>
                        <li>✓ <strong>Score checks:</strong> Updates about every three minutes with source and freshness shown</li>
                        <li>✓ <strong>Next-score view:</strong> See which squares match common scoring plays</li>
                        <li>✓ <strong>Mobile board:</strong> Readable on phones</li>
                        <li>✓ <strong>No viewer login:</strong> People open the shared link directly</li>
                    </ul>
                </Glass>

                <Glass padding="lg">
                    <h3>Broader pool platforms</h3>
                    <ul className="[&>li]:list-none">
                        <li>• May support more sports and pool formats than you need</li>
                        <li>• May require more setup for a single squares board</li>
                        <li>• May include features unrelated to football squares</li>
                        <li>• Mobile and viewer-account experiences vary by platform</li>
                    </ul>
                </Glass>
            </div>

            <h2>See what the next score changes</h2>
            <p>
                GridOne shows which squares match common next scoring plays. During the game, viewers can answer questions like <em>"What changes if they kick a field goal here?"</em> without asking the organizer.
            </p>
            <p>
                GridOne calculates this from the current displayed score and puts it beside the board. Every score shows where it came from and when, and the organizer can enter scores directly at any time.
            </p>

            <h2>Who GridOne is best for</h2>
            <p>
                GridOne fits organizers who care most about football squares: a clean board link, readable mobile layout, live scoring, and fast sharing with people who do not want another account just to check their square.
            </p>

            <h2>When a legacy pool platform may still fit</h2>
            <p>
                If you need a broad office-pool suite across many different sports formats, a larger legacy platform may still be the right tool. If your job is to run a football squares board that people can actually follow during the game, GridOne is focused on that experience.
            </p>
        </ArticleShell>
    );
};
