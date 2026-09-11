import React from 'react';
import { Link } from 'react-router-dom';
import { buildScenarioModel } from '../../viewer/scenarios/scenarioModel';
import { useScoreExplanation } from '../atmosphere/useScoreExplanation';
import { demoBoard, demoGame, demoLive, demoWinnerNow, demoWinnerSquares } from '../demoData';
import { quietLink } from './cta';

const scenarios = buildScenarioModel({ board: demoBoard, game: demoGame, live: demoLive });
const next = scenarios.scenarios.find(scenario => scenario.team === demoGame.leftAbbr && scenario.points === 3)!;
const checked = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date(demoLive.retrievedAt));
const current = { left: demoLive.leftScore % 10, top: demoLive.topScore % 10 };

export function ScoreSection() {
  const explanation = useScoreExplanation();
  return (
    <section className="editorial-gameday" aria-labelledby="score-heading">
      <div className="editorial-section">
        <header className="editorial-intro"><p className="editorial-kicker">Your group on game day</p><h2 id="score-heading">Scores update themselves.</h2><p>At the end of each quarter, the last digits of the score point to the winning square — GridOne marks it for you.</p><p>GridOne records Q1, halftime, Q3, and Final. Final uses the score at the end of the game, including overtime.</p></header>
        <div ref={explanation} data-score-explanation className="editorial-score-explanation" role="region" aria-label="How the score matches a square">
          <section className="editorial-score-card" aria-label="Sample score">
            <h3>{demoGame.title}</h3><p className="editorial-small-label">Sample game · Q{demoLive.period} · {demoLive.clock}</p>
            <div className="editorial-score-numbers"><div><span>{demoGame.leftName}</span><strong>{demoLive.leftScore}<i data-score-accent aria-hidden="true" /></strong></div><div><span>{demoGame.topName}</span><strong>{demoLive.topScore}<i data-score-accent aria-hidden="true" /></strong></div></div>
            <p className="editorial-small-label">{demoLive.sourceName} · Jan 18, 2026<br />Checked {checked} ET</p><p className="editorial-small-label">Score updates about every minute</p>
          </section>
          <div className="editorial-digit-connection"><p>Use the last digits</p><div className="editorial-digits"><span>KC <strong>{current.left}</strong></span><span>PHI <strong>{current.top}</strong></span></div><svg viewBox="0 0 180 40" aria-hidden="true"><path data-score-trace pathLength="1" d="M1 20 H170 M160 10 L170 20 L160 30" /></svg><p>One matching square</p></div>
          <div className="editorial-match-board"><p className="editorial-small-label">Sample board excerpt · PHI across, KC down</p><table><caption className="sr-only">Current matching square: {demoWinnerNow}, KC {current.left}, PHI {current.top}</caption><thead><tr><th scope="col">KC / PHI</th>{demoBoard.topAxis.slice(0, 3).map(d => <th scope="col" key={d}>{d}</th>)}</tr></thead><tbody>{demoBoard.leftAxis.slice(0, 3).map((digit, row) => <tr key={digit}><th scope="row">{digit}</th>{demoBoard.topAxis.slice(0, 3).map((top, col) => { const match = digit === current.left && top === current.top; return <td key={top} className={match ? 'is-matching' : ''}>{demoBoard.squares[row * 10 + col][0]}{match && <><span>Matching</span><i data-match-accent aria-hidden="true" /></>}</td>; })}</tr>)}</tbody></table><div className="editorial-single-match" role="group" aria-label="Current matching square"><p>KC {current.left} × PHI {current.top}</p><strong>{demoWinnerNow}</strong><span>Currently matching</span><i data-match-accent aria-hidden="true" /></div><p className="editorial-current-result"><strong>{demoWinnerNow}</strong> · Currently matching</p></div>
        </div>
        <p className="editorial-result-note">The current match can change. Quarter and final outcomes are recorded separately once confirmed. The organizer can enter a manual score when needed.</p>
        <div className="editorial-viewer-answers">
          <section><h3>Find your name. See your squares.</h3><p>Choose your name in the shared view to see every square you hold and whether one currently matches.</p><dl className="editorial-personal"><dt>Sample selection · {demoWinnerNow}</dt><dd>{demoWinnerSquares.length} squares: {demoWinnerSquares.map(s => `KC ${s.left} × PHI ${s.top}`).join(' · ')}</dd></dl><p>Optional verified winner emails follow confirmed quarter or final results.</p></section>
          <section><h3>What could match next?</h3><p>If Kansas City adds a field goal (+{next.points}), the score becomes {demoLive.leftScore + next.points}–{demoLive.topScore}.</p><dl className="editorial-personal"><dt>KC {next.left} × PHI {next.top}</dt><dd>{next.names.join(', ') || 'OPEN'} would match.</dd></dl><p>{scenarios.disclaimer}</p></section>
        </div>
        <Link to="/demo" className={`${quietLink} editorial-sample-link`}>Explore a sample board</Link>
      </div>
    </section>
  );
}
