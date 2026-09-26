import React from 'react';
import { Reveal } from '../../../design/primitives';
import { demoGame } from '../demoData';
import { ORGANIZER_FILLED, organizerDemoBoard } from '../renders/organizerDemoData';

const shownSquares = [0, 1, 61, 62];

export function OrganizerSection() {
  return (
    <section className="editorial-organizer" aria-labelledby="organizer-heading">
      <div className="editorial-section">
        <Reveal as="header" className="editorial-intro">
          <p className="editorial-kicker">Before kickoff</p>
          <h2 id="organizer-heading">Set up. Fill squares. Share.</h2>
          <p>One board from setup to the final whistle.</p>
        </Reveal>
        <div className="editorial-organizer-layout">

          <section className="editorial-workspace g-float" aria-label="Sample organizer workspace">
            <header><p className="editorial-kicker">Sample organizer workspace</p><h3>{demoGame.title}</h3><p>Chiefs at Eagles</p></header>
            <div className="editorial-workspace-status"><span><strong>{ORGANIZER_FILLED}</strong> filled</span><span><strong>{100 - ORGANIZER_FILLED}</strong> open</span><span>Numbers not drawn</span></div>
            <div className="editorial-workspace-detail">
              <div><p className="editorial-small-label">Selected excerpts from 100 squares</p><ol className="editorial-square-list" aria-label="Sample square assignments">
                {shownSquares.map(index => <li key={index} className={index === 0 ? 'is-selected' : ''}><span>Square {String(index + 1).padStart(2, '0')}</span><strong>{organizerDemoBoard.squares[index][0] || 'OPEN'}</strong>{index === 0 && <span>Selected</span>}</li>)}
              </ol></div>
              <aside className="editorial-square-detail" aria-label="Sample selected square details"><h4>Square 01</h4><dl><dt>Name on the board</dt><dd>{organizerDemoBoard.squares[0][0]}</dd><dt>Payment record · private</dt><dd>Paid</dd></dl><p>Only you see this.</p></aside>
            </div>
            <p className="editorial-workspace-next">Next: draw and lock numbers.</p>
          </section>
          <ol className="editorial-annotations" aria-label="The GridOne difference">
            <li><span aria-hidden="true">01</span><div><h3>Set up your board.</h3><p>Choose an NFL game and name your board.</p></div></li>
            <li><span aria-hidden="true">02</span><div><h3>Fill your squares.</h3><p>Add names and keep payment notes private.</p></div></li>
            <li><span aria-hidden="true">03</span><div><h3>Share one link.</h3><p>Share before kickoff. Draw and lock numbers when you’re ready.</p></div></li>
          </ol>
        </div>
        <details className="editorial-import"><summary className="min-h-11">Already have a paper board?</summary><p>Upload a photo to import it (Beta). Sign in, then review every square before publishing.</p></details>
      </div>
    </section>
  );
}
