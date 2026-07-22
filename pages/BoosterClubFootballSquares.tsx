import React from 'react';
import Header from '../components/layout/Header';
import { PageMetadata } from '../components/seo/PageMetadata';
import { ArticleCTA } from '../components/seo/ArticleCTA';
import { ArticleFAQ, faqPageSchema, FAQItem } from '../components/seo/ArticleFAQ';

const faqs: FAQItem[] = [
  {
    question: 'Are football squares a good booster club fundraiser?',
    answer: 'Football squares can work well for booster clubs because supporters usually understand the format quickly, but organizers should confirm local fundraising and gaming rules before collecting money.',
  },
  {
    question: 'How can a booster club make football squares easier to manage?',
    answer: 'Use one organizer-controlled board, publish one live viewer link, explain the payout rules before kickoff, and let supporters check winners from their phones instead of asking for screenshots.',
  },
];

export const BoosterClubFootballSquares: React.FC = () => {
  const title = 'Booster Club Football Squares Fundraiser Guide | GridOne';
  const description = 'Use football squares as a booster club fundraiser with cleaner board sharing, clearer organizer control, and one live link for supporters.';

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-gold/30 flex flex-col overflow-x-hidden">
      <PageMetadata
        title={title}
        description={description}
        path="/articles/booster-club-football-squares"
        type="article"
        schema={[
          {
            '@type': 'Article',
            headline: title,
            description,
            mainEntityOfPage: 'https://www.getgridone.com/articles/booster-club-football-squares',
            author: { '@type': 'Organization', name: 'GridOne' },
            publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icons/gridone-icon-256.png' } },
          },
          faqPageSchema(faqs),
        ]}
      />
      <Header />
      <main className="mx-auto w-full max-w-4xl px-5 py-24">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-gold ring-1 ring-gold/20 backdrop-blur-sm">Booster club</div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl text-white mb-6">Booster club football squares fundraiser guide</h1>
        <p className="text-xl text-white/70 mb-12 leading-relaxed">Booster clubs are one of the best fits for GridOne. The audience already gets the format. The win is making it easier to organize and easier to trust.</p>

        <article className="prose prose-invert prose-lg max-w-none">
          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Why booster clubs use football squares</h2>
          <p className="text-white/80 leading-relaxed mb-6">They are familiar, low-friction, and tied to games parents and supporters are already watching. That makes football squares easier to explain than most fundraiser mechanics.</p>

          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">What usually goes wrong</h2>
          <ul className="space-y-3 text-white/80">
            <li>One volunteer ends up manually sending updates all game.</li>
            <li>Board photos get buried in text threads.</li>
            <li>Supporters are not sure who won or what the payout rules were.</li>
            <li>Trust drops when the process feels sloppy.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Better booster-club setup</h2>
          <p className="text-white/80 leading-relaxed mb-6">Use one organizer-controlled board, publish one live board link, and make sure everyone can follow winners from their phone without edit access. That is the real upgrade.</p>

          <h2 className="text-2xl font-semibold text-white mt-12 mb-6">A cleaner volunteer handoff</h2>
          <ol className="space-y-3 text-white/80">
            <li>Name one board owner before the fundraiser is announced.</li>
            <li>Publish the square price, payout rules, and close time in the same message as the board link.</li>
            <li>Draw numbers only after the board is filled or sales are closed.</li>
            <li>Keep the live board link pinned in the team chat, booster page, or event thread through the final whistle.</li>
          </ol>

          <ArticleFAQ faqs={faqs} />

          <ArticleCTA
            links={[
              { to: '/articles/youth-sports-football-squares-fundraiser', label: 'Youth Sports Fundraiser Guide', primary: true },
              { to: '/articles/football-squares-fundraiser', label: 'Football Squares Fundraiser Ideas' },
              { to: '/create', label: 'Build your board' },
            ]}
          />
        </article>
      </main>
    </div>
  );
};
