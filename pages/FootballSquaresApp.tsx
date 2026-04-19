import React from 'react';
import Header from '../components/layout/Header';
import { PageMetadata } from '../components/seo/PageMetadata';
import { ArticleCTA } from '../components/seo/ArticleCTA';

export const FootballSquaresApp: React.FC = () => {
  const title = 'Football Squares App for Fundraisers, Offices, and Watch Parties | GridOne';
  const description = 'GridOne is a football squares app built for fundraisers, office pools, watch parties, and community groups that want one clean live board link.';

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-gold/30 flex flex-col overflow-x-hidden">
      <PageMetadata
        title={title}
        description={description}
        path="/articles/football-squares-app"
        type="article"
        schema={{
          '@type': 'Article',
          headline: title,
          description,
          mainEntityOfPage: 'https://www.getgridone.com/articles/football-squares-app',
          author: { '@type': 'Organization', name: 'GridOne' },
          publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icons/gridone-icon-256.png' } },
        }}
      />
      <Header />
      <main className="mx-auto w-full max-w-4xl px-5 py-24">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-live ring-1 ring-live/20 backdrop-blur-sm">Category page</div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl text-white mb-6">What a good football squares app should actually do</h1>
        <p className="text-xl text-white/70 mb-12 leading-relaxed">A football squares app is not just a digital grid. It should reduce organizer friction, make the board easy to share, and help the whole group follow the action without confusion.</p>

        <article className="prose prose-invert prose-lg max-w-none">
          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">The real job</h2>
          <p className="text-white/80 leading-relaxed mb-6">The real job of a football squares app is to replace screenshots, spreadsheet cleanup, and manual winner checking with one clean experience.</p>

          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Best-fit audiences</h2>
          <ul className="space-y-3 text-white/80">
            <li>Fundraisers</li>
            <li>Office pools</li>
            <li>Watch parties</li>
            <li>Booster clubs and community groups</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">What to look for</h2>
          <ul className="space-y-3 text-white/80">
            <li>Create and edit before paying</li>
            <li>One live board link</li>
            <li>Read-only viewer access</li>
            <li>Mobile-friendly board view</li>
            <li>Cleaner game-day winner tracking</li>
          </ul>

          <ArticleCTA
            links={[
              { to: '/articles/how-football-squares-work', label: 'How Football Squares Work', primary: true },
              { to: '/articles/run-your-pool-alternative', label: 'RunYourPool Alternative' },
              { to: '/create', label: 'Build your board' },
            ]}
          />
        </article>
      </main>
    </div>
  );
};
