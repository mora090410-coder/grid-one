import React from 'react';
import { Glass } from '../src/design/primitives';
import { ArticleShell } from '../src/features/site';
import { ArticleCTA } from '../components/seo/ArticleCTA';

export const DigitalFootballSquaresBoardVsPaper: React.FC = () => {
  const title = 'Digital Football Squares Board vs Paper Board | GridOne';
  const description = 'Compare a digital football squares board to a paper board, poster board, or screenshot-based setup for easier sharing and cleaner game-day updates.';

  return (
    <ArticleShell
      tag="Comparison"
      title={title}
      heading="Digital football squares board vs paper board"
      lede="Paper boards still work, but they create friction exactly where organizers least want it, during sharing, updates, and winner checks."
      description={description}
      path="/articles/digital-football-squares-board-vs-paper"
      type="article"
      schema={{
        '@type': 'Article',
        headline: title,
        description,
        mainEntityOfPage: 'https://www.getgridone.com/articles/digital-football-squares-board-vs-paper',
        author: { '@type': 'Organization', name: 'GridOne' },
        publisher: { '@type': 'Organization', name: 'GridOne', logo: { '@type': 'ImageObject', url: 'https://www.getgridone.com/icon-512.png' } },
      }}
      aside={
        <ArticleCTA
          links={[
            { to: '/articles/run-your-pool-alternative', label: 'RunYourPool Alternative', primary: true },
            { to: '/articles/how-football-squares-work', label: 'How Football Squares Work' },
            { to: '/create', label: 'Build your board' },
          ]}
        />
      }
    >
      <div className="my-8 grid gap-6 md:grid-cols-2">
        <Glass padding="lg">
          <h2>Digital board</h2>
          <ul>
            <li>One live link for everyone</li>
            <li>Readable on phones</li>
            <li>Cleaner winner tracking</li>
            <li>Better for offices, fundraisers, and watch parties</li>
          </ul>
        </Glass>
        <Glass padding="lg">
          <h2>Paper board</h2>
          <ul>
            <li>Usually becomes a photo in a text thread</li>
            <li>Harder to read once shared</li>
            <li>More manual organizer work</li>
            <li>More payout and winner confusion</li>
          </ul>
        </Glass>
      </div>

      <p>If your group is small and in one room, paper can survive. The moment people are remote, distracted, or checking from their phone, a digital football squares board wins fast.</p>
    </ArticleShell>
  );
};
