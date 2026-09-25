import React from 'react';
import { ArticleShell } from '../src/features/site';
import { ArticleCTA } from '../components/seo/ArticleCTA';
import { ArticleFAQ, faqPageSchema, FAQItem } from '../components/seo/ArticleFAQ';

const faqs: FAQItem[] = [
  {
    question: 'Can churches and schools use football squares for fundraising?',
    answer: 'Churches and schools can use football squares as a familiar event-based fundraiser where local rules allow it, but organizers should confirm their organization policies and local fundraising requirements first.',
  },
  {
    question: 'What makes a church or school football squares fundraiser feel trustworthy?',
    answer: 'Clear rules, one organizer, a published board link, visible winner tracking, and a simple explanation of how numbers and payouts work help supporters trust the fundraiser.',
  },
];

export const ChurchSchoolFundraiserSquares: React.FC = () => {
  const title = 'Church and School Football Squares Fundraiser Ideas | GridOne';
  const description = 'Church and school football squares fundraiser ideas with cleaner sharing, simpler organizer flow, and one live board link for supporters.';

  return (
    <ArticleShell
      tag="Church and school fundraiser"
      title={title}
      heading="Church and school football squares fundraiser ideas"
      lede="For schools and churches, the issue is not whether football squares can work. It is whether the fundraiser feels organized enough that people actually trust it."
      description={description}
      path="/articles/church-school-football-squares-fundraiser"
      type="article"
      schema={[
        {
          '@type': 'Article',
          headline: title,
          description,
          mainEntityOfPage: 'https://www.getgridone.com/articles/church-school-football-squares-fundraiser',
          author: { '@type': 'Organization', name: 'GridOne' },
          publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icon-512.png' } },
        },
        faqPageSchema(faqs),
      ]}
      aside={
        <ArticleCTA
          title="Build a fundraiser board"
          links={[
            { to: '/create', label: 'Create your free board', primary: true },
            { to: '/articles/football-squares-fundraiser', label: 'Football Squares Fundraiser Ideas' },
            { to: '/articles/booster-club-football-squares', label: 'Booster Club Guide' },
          ]}
        />
      }
    >
      <h2>Keep the process simple</h2>
      <p>The simplest version wins. Clear rules, one organizer, one live board link, and a board everyone can read from their phone. That removes most of the friction immediately.</p>

      <h2>Where this fits best</h2>
      <ul>
        <li>School sports fundraiser</li>
        <li>Church youth group fundraiser</li>
        <li>Faith community watch-party event</li>
        <li>Parent-led school support effort</li>
      </ul>

      <h2>Do the trust-building work</h2>
      <p>Explain how winners are determined, publish the rules up front, and make sure anyone participating can follow along without having to ask for an updated screenshot every quarter.</p>

      <h2>A simple rollout for community groups</h2>
      <ol className="mb-5 list-decimal pl-6">
        <li>Pick one game that already has attention in the community.</li>
        <li>Set the square price, winner schedule, and beneficiary before sharing.</li>
        <li>Use one GridOne link in newsletters, parent messages, group texts, or event pages.</li>
        <li>Keep winner updates visible during the game so supporters do not need to chase the organizer.</li>
      </ol>

      <ArticleFAQ faqs={faqs} />
    </ArticleShell>
  );
};
