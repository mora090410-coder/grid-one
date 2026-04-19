import React from 'react';
import Header from '../components/layout/Header';
import { PageMetadata } from '../components/seo/PageMetadata';
import { ArticleCTA } from '../components/seo/ArticleCTA';

export const DigitalFootballSquaresBoardVsPaper: React.FC = () => {
  const title = 'Digital Football Squares Board vs Paper Board | GridOne';
  const description = 'Compare a digital football squares board to a paper board, poster board, or screenshot-based setup for easier sharing and cleaner game-day updates.';

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-gold/30 flex flex-col overflow-x-hidden">
      <PageMetadata
        title={title}
        description={description}
        path="/articles/digital-football-squares-board-vs-paper"
        type="article"
        schema={{
          '@type': 'Article',
          headline: title,
          description,
          mainEntityOfPage: 'https://www.getgridone.com/articles/digital-football-squares-board-vs-paper',
          author: { '@type': 'Organization', name: 'GridOne' },
          publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icons/gridone-icon-256.png' } },
        }}
      />
      <Header />
      <main className="mx-auto w-full max-w-4xl px-5 py-24">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-gold ring-1 ring-gold/20 backdrop-blur-sm">Comparison</div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl text-white mb-6">Digital football squares board vs paper board</h1>
        <p className="text-xl text-white/70 mb-12 leading-relaxed">Paper boards still work, but they create friction exactly where organizers least want it, during sharing, updates, and winner checks.</p>

        <article className="prose prose-invert prose-lg max-w-none">
          <div className="my-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-gold/20">
              <h2 className="text-2xl font-semibold text-white mb-4">Digital board</h2>
              <ul className="space-y-3 text-white/80">
                <li>One live link for everyone</li>
                <li>Readable on phones</li>
                <li>Cleaner winner tracking</li>
                <li>Better for offices, fundraisers, and watch parties</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 opacity-80">
              <h2 className="text-2xl font-semibold text-white mb-4">Paper board</h2>
              <ul className="space-y-3 text-white/65">
                <li>Usually becomes a photo in a text thread</li>
                <li>Harder to read once shared</li>
                <li>More manual organizer work</li>
                <li>More payout and winner confusion</li>
              </ul>
            </div>
          </div>

          <p className="text-white/80 leading-relaxed mb-6">If your group is small and in one room, paper can survive. The moment people are remote, distracted, or checking from their phone, a digital football squares board wins fast.</p>

          <ArticleCTA
            links={[
              { to: '/articles/run-your-pool-alternative', label: 'RunYourPool Alternative', primary: true },
              { to: '/articles/how-football-squares-work', label: 'How Football Squares Work' },
              { to: '/create', label: 'Build your board' },
            ]}
          />
        </article>
      </main>
    </div>
  );
};
