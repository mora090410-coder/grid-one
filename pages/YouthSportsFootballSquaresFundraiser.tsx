import React from 'react';
import Header from '../components/layout/Header';
import { PageMetadata } from '../components/seo/PageMetadata';
import { ArticleCTA } from '../components/seo/ArticleCTA';

export const YouthSportsFootballSquaresFundraiser: React.FC = () => {
  const title = 'Youth Sports Football Squares Fundraiser Guide | GridOne';
  const description = 'Run a youth sports football squares fundraiser with less parent confusion, cleaner board sharing, and one live mobile-friendly link.';

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-gold/30 flex flex-col overflow-x-hidden">
      <PageMetadata
        title={title}
        description={description}
        path="/articles/youth-sports-football-squares-fundraiser"
        type="article"
        schema={{
          '@type': 'Article',
          headline: title,
          description,
          mainEntityOfPage: 'https://www.getgridone.com/articles/youth-sports-football-squares-fundraiser',
          author: { '@type': 'Organization', name: 'GridOne' },
          publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icons/gridone-icon-256.png' } },
        }}
      />
      <Header />
      <main className="mx-auto w-full max-w-4xl px-5 py-24">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-gold ring-1 ring-gold/20 backdrop-blur-sm">Youth sports fundraiser</div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl text-white mb-6">Youth sports football squares fundraiser guide</h1>
        <p className="text-xl text-white/70 mb-12 leading-relaxed">This is probably the cleanest early GTM lane for GridOne. Parent organizers already know the format, and they hate messy execution.</p>

        <article className="prose prose-invert prose-lg max-w-none">
          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Why this use case fits</h2>
          <p className="text-white/80 leading-relaxed mb-6">Booster clubs and youth teams need simple fundraising mechanics that people understand quickly. Football squares works because it feels familiar, social, and tied to a real event.</p>
          <p className="text-white/80 leading-relaxed mb-6">Where it breaks is the admin load. One parent ends up managing the board, answering winner questions, and sending updates manually.</p>

          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">What parents actually need</h2>
          <ul className="space-y-3 text-white/80">
            <li>One live board link they can drop into the team chat</li>
            <li>A clean mobile view for parents and supporters</li>
            <li>Clear organizer control so the board does not get mangled</li>
            <li>Less confusion during the game</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Keep it trustworthy</h2>
          <p className="text-white/80 leading-relaxed mb-6">Draw the numbers after all the spots are filled, explain payout rules clearly, and confirm any local fundraising rules before collecting money. The cleaner the process feels, the easier it is for families to trust it.</p>

          <ArticleCTA
            links={[
              { to: '/articles/football-squares-fundraiser', label: 'Football Squares Fundraiser Ideas', primary: true },
              { to: '/articles/how-to-run-super-bowl-squares', label: 'How to Run Super Bowl Squares' },
              { to: '/create', label: 'Build your board' },
            ]}
          />
        </article>
      </main>
    </div>
  );
};
