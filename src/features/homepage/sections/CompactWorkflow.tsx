import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { trackViewDemo } from './cta';

export function CompactWorkflow() {
  const [view, setView] = useState<'organizer' | 'gameday'>('organizer');
  return <section className="compact-flow compact-section" aria-labelledby="workflow-heading">
    <div className="compact-flow-copy"><p className="compact-kicker">One board. Two views.</p><h2 id="workflow-heading">From setup to game day.</h2><p>Seller links for your families. One place to see what’s filled.</p><Link to="/articles/football-squares-fundraiser">Read the fundraiser guide <span aria-hidden="true">→</span></Link></div>
    <div className="compact-flow-example"><div className="compact-toggle" role="group" aria-label="Sample views"><button type="button" aria-pressed={view === 'organizer'} aria-controls="workflow-example" onClick={() => setView('organizer')}>Organizer view</button><button type="button" aria-pressed={view === 'gameday'} aria-controls="workflow-example" onClick={() => setView('gameday')}>Game day view</button></div>
      <div id="workflow-example" className="compact-example-content" aria-live="polite">
        <p className="compact-example-label">Illustrative {view === 'organizer' ? 'organizer' : 'game-day'} view</p>
        {view === 'organizer' ? <><div className="compact-example-row"><strong>Family A</strong><span>4 squares open</span></div><div className="compact-example-row"><strong>Family B</strong><span>2 squares open</span></div><p className="compact-example-note">Seller links accept claims for that seller’s unsold squares until numbers lock. Public viewer links are viewing only.</p></> : <><div className="compact-example-row"><strong>KC 17 · PHI 14</strong><span>Q3 · sample</span></div><div className="compact-example-row"><strong>Taylor M.</strong><span>Matching now · 7 × 4</span></div><p className="compact-example-note">See which next score matches a square. Math, not odds. The illustration is not a confirmed quarter result.</p></>}
      </div>
      <Link to="/demo" onClick={trackViewDemo} className="compact-demo-link">Explore the sample board <span aria-hidden="true">→</span></Link>
    </div>
  </section>;
}
