import React from 'react';
import Header from '../components/layout/Header';
import { PageMetadata } from '../components/seo/PageMetadata';
import { ArticleCTA } from '../components/seo/ArticleCTA';

export const ChurchSchoolFundraiserSquares: React.FC = () => {
  const title = 'Church and School Football Squares Fundraiser Ideas | GridOne';
  const description = 'Church and school football squares fundraiser ideas with cleaner sharing, simpler organizer flow, and one live board link for supporters.';

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-gold/30 flex flex-col overflow-x-hidden">
      <PageMetadata
        title={title}
        description={description}
        path="/articles/church-school-football-squares-fundraiser"
        type="article"
        schema={{
          '@type': 'Article',
          headline: title,
          description,
          mainEntityOfPage: 'https://www.getgridone.com/articles/church-school-football-squares-fundraiser',
          author: { '@type': 'Organization', name: 'GridOne' },
          publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icons/gridone-icon-256.png' } },
        }}
      />
      <Header />
      <main className="mx-auto w-full max-w-4xl px-5 py-24">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-live ring-1 ring-live/20 backdrop-blur-sm">Church and school fundraiser</div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl text-white mb-6">Church and school football squares fundraiser ideas</h1>
        <p className="text-xl text-white/70 mb-12 leading-relaxed">For schools and churches, the issue is not whether football squares can work. It is whether the fundraiser feels organized enough that people actually trust it.</p>

        <article className="prose prose-invert prose-lg max-w-none">
          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Keep the process simple</h2>
          <p className="text-white/80 leading-relaxed mb-6">The simplest version wins. Clear rules, one organizer, one live board link, and a board everyone can read from their phone. That removes most of the friction immediately.</p>

          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Where this fits best</h2>
          <ul className="space-y-3 text-white/80">
            <li>School sports fundraiser</li>
            <li>Church youth group fundraiser</li>
            <li>Faith community watch-party event</li>
            <li>Parent-led school support effort</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Do the trust-building work</h2>
          <p className="text-white/80 leading-relaxed mb-6">Explain how winners are determined, publish the rules up front, and make sure anyone participating can follow along without having to ask for an updated screenshot every quarter.</p>

          <ArticleCTA
            links={[
              { to: '/articles/football-squares-fundraiser', label: 'Football Squares Fundraiser Ideas', primary: true },
              { to: '/articles/booster-club-football-squares', label: 'Booster Club Guide' },
              { to: '/create', label: 'Build your board' },
            ]}
          />
        </article>
      </main>
    </div>
  );
};
