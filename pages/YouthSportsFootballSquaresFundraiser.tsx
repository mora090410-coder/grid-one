import React from 'react';
import { ArticleShell } from '../src/features/site';
import { ArticleCTA } from '../components/seo/ArticleCTA';
import { ArticleFAQ, faqPageSchema, FAQItem } from '../components/seo/ArticleFAQ';

const faqs: FAQItem[] = [
  {
    question: 'How do youth sports teams run football squares fundraisers?',
    answer: 'Most youth sports teams sell squares before a football game, draw numbers after the board fills, publish the rules, and let supporters follow quarter winners during the game.',
  },
  {
    question: 'What makes a youth sports football squares fundraiser easier to manage?',
    answer: 'A single live board link, clear payout rules, mobile-friendly viewing, and organizer-only editing reduce the manual updates and text-thread confusion that usually slow parent volunteers down.',
  },
];

export const YouthSportsFootballSquaresFundraiser: React.FC = () => {
  const title = 'Youth Sports Football Squares Fundraiser Guide | GridOne';
  const description = 'Run a youth sports football squares fundraiser with less parent confusion, cleaner board sharing, and one live mobile-friendly link.';

  return (
    <ArticleShell
      tag="Youth sports fundraiser"
      title={title}
      heading="Youth sports football squares fundraiser guide"
      lede="Youth-sports fundraisers are a strong fit for GridOne because parent organizers already know the format and need a cleaner way to run it."
      description={description}
      path="/articles/youth-sports-football-squares-fundraiser"
      type="article"
      schema={[
        {
          '@type': 'Article',
          headline: title,
          description,
          mainEntityOfPage: 'https://www.getgridone.com/articles/youth-sports-football-squares-fundraiser',
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
            { to: '/articles/how-to-run-super-bowl-squares', label: 'How to Run Super Bowl Squares' },
          ]}
        />
      }
    >
      <h2>Why this use case fits</h2>
      <p>Booster clubs and youth teams need simple fundraising mechanics that people understand quickly. Football squares works because it feels familiar, social, and tied to a real event.</p>
      <p>Where it breaks is the admin load. One parent ends up managing the board, answering winner questions, and sending updates manually.</p>

      <h2>What parents actually need</h2>
      <ul>
        <li>One live board link they can drop into the team chat</li>
        <li>A clean mobile view for parents and supporters</li>
        <li>Clear organizer control so the board does not get mangled</li>
        <li>Less confusion during the game</li>
      </ul>

      <h2>A simple team rollout</h2>
      <ul>
        <li>Pick one game and one clear price per square.</li>
        <li>Share the GridOne board link in the team chat, parent email, or booster club page.</li>
        <li>Close sales, draw numbers, and publish the final board before kickoff.</li>
        <li>Use the live board during the game so supporters can check winners without asking the organizer.</li>
      </ul>

      <h2>Keep it trustworthy</h2>
      <p>Draw the numbers after all the spots are filled, explain payout rules clearly, and confirm any local fundraising rules before collecting money. The cleaner the process feels, the easier it is for families to trust it.</p>

      <ArticleFAQ faqs={faqs} />
    </ArticleShell>
  );
};
