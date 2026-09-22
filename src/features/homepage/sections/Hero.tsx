import React from 'react';
import { Link } from 'react-router-dom';
import { DEMO_LABEL, demoGame, demoLive, demoWinnerNow } from '../demoData';
import { MONEY_BOUNDARY } from '../pricing';
import { ORGANIZER_FILLED, organizerDemoBoard } from '../renders/organizerDemoData';
import { Enter } from '../../../design/primitives';
import { SiteHeader } from '../../site/SiteHeader';
import { quietLink } from './cta';
import { PrimaryCtaLink } from './PrimaryCtaLink';
import './hero-studio.css';

// Numbered excerpts keep the real sample assignments legible without scaling 100 cells.
const excerptIndexes = [0, 1, 2, 3, 60, 61, 62, 63];
const checkedTime = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
}).format(new Date(demoLive.retrievedAt));

function PreparationExcerpt() {
  return (
    <section data-base="cream" className="hero-preparation" aria-label="Prepare your board">
      <div className="hero-excerpt-label"><h2>Prepare your board</h2><span>Before kickoff</span></div>
      <div className="hero-preparation-content">
        <h3>{demoGame.title}</h3>
        <p className="hero-matchup">Chiefs at Eagles</p>
        <div className="hero-board-counts"><span><strong>{ORGANIZER_FILLED}</strong> filled</span><span><strong>{100 - ORGANIZER_FILLED}</strong> open</span><span>100 squares</span></div>
        <p className="hero-excerpt-note">A closer look at your squares</p>
        <ol className="hero-square-excerpt" aria-label="Selected sample squares">
          {excerptIndexes.map((index) => {
            const name = organizerDemoBoard.squares[index][0];
            return <li key={index} className={name ? '' : 'hero-square-open'}>
              <span className="hero-square-number">{String(index + 1).padStart(2, '0')}</span>
              <span>{name || 'OPEN'}</span>
            </li>;
          })}
        </ol>
        <div className="hero-preparation-state"><span>Numbers not drawn</span><span>Next: Draw numbers</span></div>
      </div>
    </section>
  );
}

function GameDayExcerpt() {
  return (
    <section data-base="dark" className="hero-gameday" aria-label="Your group on game day">
      <div className="hero-excerpt-label"><h2>Your group on game day</h2><span>After publishing</span></div>
      <div className="hero-gameday-content">
        <h3>{demoGame.title}</h3>
        <p className="hero-published-state">Published · numbers locked</p>
        <div className="hero-sample-score" aria-label={`Sample score: ${demoGame.leftName} ${demoLive.leftScore}, ${demoGame.topName} ${demoLive.topScore}, third quarter`}>
          <span><span>{demoGame.leftAbbr}</span><strong>{demoLive.leftScore}</strong></span>
          <span className="hero-score-period">Q{demoLive.period}<br />{demoLive.clock}</span>
          <span><span>{demoGame.topAbbr}</span><strong>{demoLive.topScore}</strong></span>
        </div>
        <div className="hero-current-match"><div><span>Currently matching</span><strong>{demoWinnerNow}</strong></div><p>KC <strong>{demoLive.leftScore % 10}</strong><span aria-hidden="true"> × </span> PHI <strong>{demoLive.topScore % 10}</strong></p></div>
        <p className="hero-score-source">{demoLive.sourceName} · Jan 18, 2026 · {checkedTime} ET</p>
      </div>
    </section>
  );
}

export function Hero() {
  return (
    <section data-sc-act="flow" data-testid="homepage-first-viewport" className="studio-hero">
      <div className="studio-hero-shell">
        <SiteHeader />
        <div className="studio-hero-layout">
          <div className="studio-hero-copy">
            <Enter delay={0}><p className="hero-category">Football squares, together.</p></Enter>
            <Enter as="h1" delay={40} className="studio-hero-title">Your fundraiser. <span>One clear board.</span></Enter>
            <Enter delay={80}><p className="studio-hero-description">Build your football squares board, share one link, and give your group a clear view of game day.</p></Enter>
            <Enter delay={120}>
              <div className="studio-hero-actions">
                <PrimaryCtaLink to="/create">Create your free board</PrimaryCtaLink>
                <Link to="/demo" className={quietLink}>Explore a sample board</Link>
              </div>
            </Enter>
            <Enter delay={120}>
              <ul className="studio-hero-reassurance"><li>First published board free</li><li>Viewers don’t need an account</li></ul>
              <p className="studio-hero-boundary">{MONEY_BOUNDARY}</p>
            </Enter>
          </div>
          <Enter delay={80} className="studio-hero-stage">
            {/* Viewer first in reading order: the compact answer precedes setup on a phone. */}
            <GameDayExcerpt />
            <PreparationExcerpt />
            <p className="hero-story-connection">Prepare it. Publish it.<br /><span>Everyone follows one link.</span></p>
            <p className="studio-hero-caption">{DEMO_LABEL}</p>
          </Enter>
        </div>
      </div>
    </section>
  );
}
