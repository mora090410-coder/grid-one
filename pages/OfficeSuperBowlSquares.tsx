import React from 'react';
import { Link } from 'react-router-dom';
import { Glass } from '../src/design/primitives';
import { primaryLink } from '../src/features/homepage/sections/cta';
import { ArticleShell } from '../src/features/site';
import { ArticleCTA } from '../components/seo/ArticleCTA';

export const OfficeSuperBowlSquares: React.FC = () => {
  const title = 'Office Super Bowl Squares Without Spreadsheet Chaos | GridOne';
  const description = 'Run office Super Bowl squares online with one clean live board link, easier score tracking, and fewer payout disputes.';

  return (
    <ArticleShell
      tag="Office Pool Guide"
      title={title}
      heading="Office Super Bowl squares without the spreadsheet circus"
      lede="The office pool itself is fun. The annoying part is the organizer getting stuck as unpaid tech support once screenshots, payouts, and score questions start flying."
      description={description}
      path="/articles/office-super-bowl-squares"
      type="article"
      schema={{
        '@type': 'Article',
        headline: title,
        description,
        mainEntityOfPage: 'https://www.getgridone.com/articles/office-super-bowl-squares',
        author: { '@type': 'Organization', name: 'GridOne' },
        publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icon-512.png' } },
      }}
      aside={
        <>
          <div className="flex flex-col items-start gap-4">
            <Link to="/create" className={primaryLink}>
              Build your office board →
            </Link>
          </div>

          <ArticleCTA
            title="Related guides"
            links={[
              { to: '/articles/super-bowl-squares-ideas', label: 'Super Bowl Squares Ideas', primary: true },
              { to: '/articles/run-your-pool-alternative', label: 'Compare GridOne to older tools' },
              { to: '/articles/football-squares-fundraiser', label: 'See fundraiser use cases' },
            ]}
          />
        </>
      }
    >
      <h2>What people actually want</h2>
      <p>
        Coworkers want to glance at the board, see who is winning, and stop asking where the latest photo is. Organizers want fewer disputes and less cleanup.
      </p>

      <div className="my-12 grid gap-6 md:grid-cols-2">
        <Glass padding="lg">
          <h3>Better office squares flow</h3>
          <ul>
            <li>One live board link for the whole office</li>
            <li>Read-only viewer experience on phones</li>
            <li>Live winners and next-score scenarios</li>
            <li>Cleaner handoff than spreadsheet plus group chat</li>
          </ul>
        </Glass>
        <Glass padding="lg">
          <h3>Typical mess</h3>
          <ul>
            <li>Someone uploads one blurry photo</li>
            <li>People keep asking for updated scores</li>
            <li>Manual checking creates payout arguments</li>
            <li>The organizer becomes the bottleneck</li>
          </ul>
        </Glass>
      </div>

      <h2>Use this if you are organizing for:</h2>
      <ul>
        <li>An office Super Bowl party</li>
        <li>A department morale event</li>
        <li>A customer appreciation watch party</li>
        <li>A local business community event</li>
      </ul>
    </ArticleShell>
  );
};
