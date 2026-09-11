import React from 'react';
import { demoGame } from '../demoData';
import { MONEY_BOUNDARY } from '../pricing';
import { ORGANIZER_FILLED, organizerDemoBoard } from '../renders/organizerDemoData';

const shownSquares = [0, 1, 61, 62];

export function OrganizerSection() {
  return (
    <section data-base="cream" className="editorial-organizer" aria-labelledby="organizer-heading">
      <div className="editorial-section">
        <header className="editorial-intro">
          <p className="editorial-kicker">Before kickoff</p>
          <h2 id="organizer-heading">Less paper. Less chasing.</h2>
          <p>Names, open squares, and what comes next. Keep the preparation in one place, then share one link with your group.</p>
        </header>
        <div className="editorial-intro">
          <h3 id="chaos-heading">The chaos</h3>
          <ul aria-labelledby="chaos-heading" className="list-disc pl-5 font-ui text-base text-fg-2">
            <li>Blurry board photos</li>
            <li>Group chats full of "who won?"</li>
            <li>Numbers get mixed up</li>
            <li>Two people claiming the same square</li>
            <li>Paying for a full party when half the squares are empty</li>
            <li>Nobody knows where to look on game day</li>
          </ul>
        </div>
        <div className="editorial-organizer-layout">

          <section className="editorial-workspace" aria-label="Sample organizer workspace">
            <header><p className="editorial-kicker">Sample organizer workspace</p><h3>{demoGame.title}</h3><p>Chiefs at Eagles</p></header>
            <div className="editorial-workspace-status"><span><strong>{ORGANIZER_FILLED}</strong> filled</span><span><strong>{100 - ORGANIZER_FILLED}</strong> open</span><span>Numbers not drawn</span></div>
            <div className="editorial-workspace-detail">
              <div><p className="editorial-small-label">Selected excerpts from 100 squares</p><ol className="editorial-square-list" aria-label="Sample square assignments">
                {shownSquares.map(index => <li key={index} className={index === 0 ? 'is-selected' : ''}><span>Square {String(index + 1).padStart(2, '0')}</span><strong>{organizerDemoBoard.squares[index][0] || 'OPEN'}</strong>{index === 0 && <span>Selected</span>}</li>)}
              </ol></div>
              <aside className="editorial-square-detail" aria-label="Sample selected square details"><h4>Square 01</h4><dl><dt>Name on the board</dt><dd>{organizerDemoBoard.squares[0][0]}</dd><dt>Payment record · private</dt><dd>Paid</dd></dl><p>A private note for the organizer, not a payment through GridOne.</p></aside>
            </div>
            <p className="editorial-workspace-next">Next: Draw numbers, preview, then publish.</p>
          </section>
          <ol className="editorial-annotations" aria-label="The GridOne difference">
            <li><span aria-hidden="true">01</span><div><h3>Keep names together.</h3><p>Assign one square or a whole block. Everyone has a place on the board.</p></div></li>
            <li><span aria-hidden="true">02</span><div><h3>See what’s still open.</h3><p>Review the remaining OPEN squares before you draw and lock the game numbers.</p></div></li>
            <li><span aria-hidden="true">03</span><div><h3>Share when you’re ready.</h3><p>Share during preparation. After you publish, that same link becomes the game-day view.</p></div></li>
            <li><span aria-hidden="true">04</span><div><h3>Bring your paper board.</h3><p>Already have a paper board? Upload a photo and let GridOne help digitize it. (Beta)</p><p>Sign in to import, then review every square before publishing.</p></div></li>
          </ol>
        </div>
        <p className="editorial-boundary">{MONEY_BOUNDARY}</p>
      </div>
    </section>
  );
}
