import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { PageMetadata } from '../components/seo/PageMetadata';

export const OfficeSuperBowlSquares: React.FC = () => {
  const title = 'Office Super Bowl Squares Without Spreadsheet Chaos | GridOne';
  const description = 'Run office Super Bowl squares online with one clean live board link, easier score tracking, and fewer payout disputes.';

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-gold/30 flex flex-col overflow-x-hidden">
      <PageMetadata
        title={title}
        description={description}
        path="/articles/office-super-bowl-squares"
        type="article"
        schema={{
          '@type': 'Article',
          headline: title,
          description,
          mainEntityOfPage: 'https://www.getgridone.com/articles/office-super-bowl-squares',
          author: { '@type': 'Organization', name: 'GridOne' },
          publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icons/gridone-icon-256.png' } },
        }}
      />
      <Header />
      <main className="mx-auto w-full max-w-4xl px-5 py-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-live ring-1 ring-live/20 backdrop-blur-sm">
          Office Pool Guide
        </div>

        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl text-white mb-6">
          Office Super Bowl squares without the spreadsheet circus
        </h1>

        <p className="text-xl text-white/70 mb-12 leading-relaxed">
          The office pool itself is fun. The annoying part is the organizer getting stuck as unpaid tech support once screenshots, payouts, and score questions start flying.
        </p>

        <article className="prose prose-invert prose-lg max-w-none">
          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">What people actually want</h2>
          <p className="text-white/80 leading-relaxed mb-6">
            Coworkers want to glance at the board, see who is winning, and stop asking where the latest photo is. Organizers want fewer disputes and less cleanup.
          </p>

          <div className="my-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-gold/20">
              <h3 className="text-xl font-bold text-gold mb-4">Better office squares flow</h3>
              <ul className="space-y-3 text-sm text-white/80">
                <li>One live board link for the whole office</li>
                <li>Read-only viewer experience on phones</li>
                <li>Live winners and next-score scenarios</li>
                <li>Cleaner handoff than spreadsheet plus group chat</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 opacity-80">
              <h3 className="text-xl font-bold text-white mb-4">Typical mess</h3>
              <ul className="space-y-3 text-sm text-white/65">
                <li>Someone uploads one blurry photo</li>
                <li>People keep asking for updated scores</li>
                <li>Manual checking creates payout arguments</li>
                <li>The organizer becomes the bottleneck</li>
              </ul>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Use this if you are organizing for:</h2>
          <ul className="space-y-3 text-white/80">
            <li>An office Super Bowl party</li>
            <li>A department morale event</li>
            <li>A customer appreciation watch party</li>
            <li>A local business community event</li>
          </ul>

          <div className="mt-16 text-center">
            <Link to="/create" className="inline-flex items-center justify-center gap-2 rounded-full bg-cardinal px-8 py-4 text-lg font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:brightness-110 hover:shadow-lg transition-all active:scale-95">
              Build your office board →
            </Link>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to="/articles/run-your-pool-alternative" className="text-sm text-gold hover:text-white transition-colors">Compare GridOne to older tools</Link>
              <Link to="/articles/football-squares-fundraiser" className="text-sm text-gold hover:text-white transition-colors">See fundraiser use cases</Link>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
};
