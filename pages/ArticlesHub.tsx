import React from 'react';
import { Link } from 'react-router-dom';
import { CapsuleTag, Eyebrow, Glass } from '../src/design/primitives';
import { PrimaryCtaLink } from '../src/features/homepage/sections/PrimaryCtaLink';
import { SitePage } from '../src/features/site';
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
    desc: 'Run an office board with better mobile viewing and fewer winner questions.',
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
    title: 'Booster Club Football Squares Fundraiser Guide',
    desc: 'A practical guide for booster clubs that need a cleaner way to run a football-squares fundraiser.',
    to: '/articles/booster-club-football-squares',
    tag: 'Booster club',
  },
  {
    title: 'Church and School Football Squares Fundraiser Ideas',
    desc: 'How schools and churches can run a clear, organizer-owned football-squares fundraiser.',
    to: '/articles/church-school-football-squares-fundraiser',
    tag: 'School / church',
  },
  {
    title: 'NFL Opening Week Squares Pool Ideas',
    desc: 'Ideas for opening-week office boards, watch parties, and community events.',
    to: '/articles/nfl-opening-week-squares-pool',
    tag: 'NFL opening week',
  },
  {
    title: 'Football Squares App',
    desc: 'What to look for in a football-squares app before you build and share a board.',
    to: '/articles/football-squares-app',
    tag: 'Category',
  },
  {
    title: 'RunYourPool Alternative',
    desc: 'Compare a focused football-squares board with broader pool platforms.',
    to: '/articles/run-your-pool-alternative',
    tag: 'Alternative',
  },
];

export const ArticlesHub: React.FC = () => {
  const title = 'GridOne Articles and Guides | Football Squares, Fundraisers, and Super Bowl Squares';
  const description = 'GridOne guides for football squares, Super Bowl squares, fundraisers, office pools, and digital board alternatives.';

  return (
    <SitePage width="wide">
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
      <div className="flex max-w-[720px] flex-col gap-4">
        <Eyebrow>Organizer guides</Eyebrow>
        <h1 className="font-display text-[40px] leading-[1.05] text-fg md:text-[52px]">
          Football squares guides for organizers
        </h1>
        <p className="font-ui text-[19px] leading-[1.5] text-fg-2">
          Practical help for fundraiser teams, booster clubs, offices, and community groups that need one clean board link.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ARTICLES.map((article) => (
          <Link
            key={article.to}
            to={article.to}
            className="group rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
          >
            <Glass padding="lg" className="flex h-full flex-col items-start gap-3 group-hover:bg-panel-hover">
              <CapsuleTag>{article.tag}</CapsuleTag>
              <h2 className="font-display text-[22px] leading-[1.15] text-fg">{article.title}</h2>
              <p className="font-ui text-[15px] leading-[1.6] text-fg-2">{article.desc}</p>
              <span className="mt-auto pt-2 font-ui text-[15px] text-tone-gold group-hover:underline underline-offset-4">Read guide</span>
            </Glass>
          </Link>
        ))}
      </div>

      <Glass padding="lg" className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[28px] leading-[1.1] text-fg">Ready to run your board?</h2>
          <p className="font-ui text-[17px] leading-[1.6] text-fg-2">Build and preview for free. Your first published board is free.</p>
        </div>
        <PrimaryCtaLink to="/create">Create your free board</PrimaryCtaLink>
      </Glass>
    </SitePage>
  );
};
