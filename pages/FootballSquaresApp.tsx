import React from 'react';
import { ArticleShell } from '../src/features/site';
import { ArticleCTA } from '../components/seo/ArticleCTA';

export const FootballSquaresApp: React.FC = () => {
  const title = 'Football Squares App for Fundraisers, Offices, and Watch Parties | GridOne';
  const description = 'GridOne is a football squares app built for fundraisers, office pools, watch parties, and community groups that want one clean live board link.';

  return (
    <ArticleShell
      tag="Category page"
      title={title}
      heading="What a good football squares app should actually do"
      lede="A football squares app is not just a digital grid. It should reduce organizer friction, make the board easy to share, and help the whole group follow the action without confusion."
      description={description}
      path="/articles/football-squares-app"
      type="article"
      schema={{
        '@type': 'Article',
        headline: title,
        description,
        mainEntityOfPage: 'https://www.getgridone.com/articles/football-squares-app',
        author: { '@type': 'Organization', name: 'GridOne' },
        publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icon-512.png' } },
      }}
      aside={
        <ArticleCTA
          title="Build a fundraiser board"
          links={[
            { to: '/create', label: 'Create your free board', primary: true },
            { to: '/articles/how-football-squares-work', label: 'How Football Squares Work' },
            { to: '/articles/run-your-pool-alternative', label: 'RunYourPool Alternative' },
          ]}
        />
      }
    >
      <h2>The real job</h2>
      <p>The real job of a football squares app is to replace screenshots, spreadsheet cleanup, and manual winner checking with one clean experience.</p>

      <h2>Best-fit audiences</h2>
      <ul>
        <li>Fundraisers</li>
        <li>Office pools</li>
        <li>Watch parties</li>
        <li>Booster clubs and community groups</li>
      </ul>

      <h2>What to look for</h2>
      <ul>
        <li>Create and edit before paying</li>
        <li>One live board link</li>
        <li>Read-only viewer access</li>
        <li>Mobile-friendly board view</li>
        <li>Cleaner game-day winner tracking</li>
      </ul>
    </ArticleShell>
  );
};
