import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { PageMetadata } from '../components/seo/PageMetadata';

const ARTICLES = [
  {
    title: 'How to Run Super Bowl Squares Online',
    desc: 'Step-by-step guide for building, sharing, and managing football squares without poster-board confusion.',
    to: '/articles/how-to-run-super-bowl-squares',
    tag: 'How-to',
  },
  {
    title: 'Football Squares Fundraiser Ideas',
    desc: 'Fundraiser-focused guidance for booster clubs, youth teams, churches, and community groups.',
    to: '/articles/football-squares-fundraiser',
    tag: 'Fundraiser',
  },
  {
    title: 'Youth Sports Football Squares Fundraiser',
    desc: 'A tighter playbook for parent organizers and booster clubs running football squares to raise money.',
    to: '/articles/youth-sports-football-squares-fundraiser',
    tag: 'Youth sports',
  },
  {
    title: 'Office Super Bowl Squares',
    desc: 'Cleaner office pools, better mobile viewing, and fewer payout disputes.',
    to: '/articles/office-super-bowl-squares',
    tag: 'Office',
  },
  {
    title: 'How Football Squares Work',
    desc: 'Plain-English explanation of the 10x10 grid, random numbers, and quarter winners.',
    to: '/articles/how-football-squares-work',
    tag: 'Explainer',
  },
  {
    title: 'Super Bowl Squares Ideas',
    desc: 'Simple ideas to make your board easier to run and more fun for the whole group.',
    to: '/articles/super-bowl-squares-ideas',
    tag: 'Seasonal',
  },
  {
    title: 'Digital Football Squares Board vs Paper Board',
    desc: 'A direct comparison between old-school poster boards and a live digital viewer link.',
    to: '/articles/digital-football-squares-board-vs-paper',
    tag: 'Comparison',
  },
  {
    title: 'RunYourPool Alternative',
    desc: 'Why organizers looking for a modern RunYourPool alternative end up wanting a cleaner mobile experience.',
    to: '/articles/run-your-pool-alternative',
    tag: 'Alternative',
  },
];

export const ArticlesHub: React.FC = () => {
  const title = 'GridOne Articles and Guides | Football Squares, Fundraisers, and Super Bowl Squares';
  const description = 'GridOne guides for football squares, Super Bowl squares, fundraisers, office pools, and digital board alternatives.';

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-gold/30 flex flex-col overflow-x-hidden">
      <PageMetadata
        title={title}
        description={description}
        path="/articles"
        type="website"
        schema={{
          '@type': 'CollectionPage',
          name: title,
          description,
          url: 'https://www.getgridone.com/articles',
        }}
      />
      <Header />
      <main className="mx-auto w-full max-w-6xl px-5 py-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="max-w-3xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-gold ring-1 ring-gold/20 backdrop-blur-sm">
            Article Hub
          </div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl text-white mb-6">
            GridOne guides built to capture real football squares search traffic
          </h1>
          <p className="text-xl text-white/70 mb-12 leading-relaxed">
            No fluff. Just the pages people actually search for when they want to run football squares, organize a fundraiser, or replace a messy paper board.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {ARTICLES.map((article) => (
            <Link key={article.to} to={article.to} className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 hover:bg-white/[0.07] transition-colors">
              <div className="inline-flex rounded-full bg-white/5 px-3 py-1 text-xs text-gold ring-1 ring-gold/20">{article.tag}</div>
              <h2 className="mt-4 text-xl font-semibold text-white">{article.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70">{article.desc}</p>
              <div className="mt-5 text-sm font-medium text-gold">Read guide →</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};
