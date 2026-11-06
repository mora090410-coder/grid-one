import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { demoBoard, demoLive, DEMO_LABEL } from '../demoData';
import { trackViewDemo } from './cta';

const stages = ['Set up', 'Share', 'Game day'] as const;

/** Local illustration only. Never creates a board, claim, score, or share capability. */
export function SampleBoard() {
  const [stage, setStage] = useState<typeof stages[number]>('Set up');
  const [selected, setSelected] = useState(0);
  // Focus reads gridcells itself; only inspection controls populate this stable live region.
  const [announcement, setAnnouncement] = useState('');
  const cells = useRef<Array<HTMLButtonElement | null>>([]);
  const gameDay = stage === 'Game day';
  const selectedRow = Math.floor(selected / 10);
  const selectedColumn = selected % 10;
  const nameAt = (index: number) => demoBoard.squares[index][0] || 'OPEN';
  const inspectSquare = (index: number) => {
    setAnnouncement('');
    setSelected(index);
  };
  const move = (event: React.KeyboardEvent, index: number) => {
    const row = Math.floor(index / 10);
    const target = ({ ArrowRight: Math.min(index + 1, row * 10 + 9), ArrowLeft: Math.max(index - 1, row * 10), ArrowDown: Math.min(index + 10, 99), ArrowUp: Math.max(index - 10, 0), Home: row * 10, End: row * 10 + 9 } as Record<string, number>)[event.key];
    if (target === undefined) return;
    event.preventDefault();
    setAnnouncement('');
    setSelected(target);
    cells.current[target]?.focus();
  };
  return (
    <section className="sample-experience" aria-label="Interactive sample board">
      <div className="sample-steps" style={{ '--g-sample-stage': stages.indexOf(stage) } as React.CSSProperties} role="group" aria-label="Explore the board journey">
        {stages.map((item, index) => <button type="button" className="min-h-11" key={item} aria-pressed={stage === item} onClick={() => { setAnnouncement(''); setStage(item); }}><span aria-hidden="true">0{index + 1}</span>{item}</button>)}
      </div>
      <div className="sample-stage-copy">
        <div aria-hidden={stage !== 'Set up'}><h2>A place for every supporter.</h2><p>Name your board, choose an NFL game, then assign sellers and names.</p></div>
        <div aria-hidden={stage !== 'Share'}><h2>One board. The right link.</h2><p>Public viewer link: viewing only, no account needed. Separate seller links let buyers claim that seller’s unsold squares before numbers lock.</p></div>
        <div aria-hidden={!gameDay}><h2>Follow the game. Know your square.</h2><p>Illustrative score: KC {demoLive.leftScore} · PHI {demoLive.topScore} · Q3. Currently matching: Taylor M.</p></div>
      </div>
      <div className="sample-board-sheet">
        <header><h3>Sample board</h3><span>10 × 10 · 100 squares</span></header>
        <p className="sample-disclosure">{DEMO_LABEL}</p>
        <p className="sample-guide">Select a numbered square to see its name and position.</p>
        <p className="sample-axis-label">{gameDay ? 'Philadelphia · last digit of score' : 'Game numbers stay private until locked'}</p>
        <div role="grid" aria-label="Sample football squares" className="sample-grid" data-game-day={gameDay}>
          <div role="row" className="sample-grid-row sample-axis"><span role="columnheader" aria-label="Kansas City side axis" />{Array.from({ length: 10 }, (_, column) => <span role="columnheader" key={column} data-inspected={column === selectedColumn} aria-label={`Philadelphia column ${column + 1}, ${gameDay ? `digit ${demoBoard.topAxis[column]}` : 'numbers not drawn'}`}><span className="sample-axis-digit">{gameDay ? demoBoard.topAxis[column] : '–'}</span></span>)}</div>
          {Array.from({ length: 10 }, (_, row) => <div role="row" className="sample-grid-row" key={row}>
            <span role="rowheader" className="sample-axis" data-inspected={row === selectedRow} aria-label={`Kansas City row ${row + 1}, ${gameDay ? `digit ${demoBoard.leftAxis[row]}` : 'numbers not drawn'}`}><span className="sample-axis-digit">{gameDay ? demoBoard.leftAxis[row] : '–'}</span></span>
            {Array.from({ length: 10 }, (_, column) => {
              const index = row * 10 + column;
              const name = nameAt(index);
              return <button type="button" role="gridcell" key={index} ref={element => { cells.current[index] = element; }} tabIndex={selected === index ? 0 : -1} aria-selected={selected === index} aria-label={`Square ${index + 1}, ${name}, row ${row + 1} column ${column + 1}${gameDay ? `, KC ${demoBoard.leftAxis[row]} PHI ${demoBoard.topAxis[column]}${index === 0 ? ', currently matching' : ''}` : ', numbers not drawn'}`} data-track={row === selectedRow || column === selectedColumn} data-filled={name !== 'OPEN'} data-current={gameDay && index === 0} onFocus={() => inspectSquare(index)} onClick={() => inspectSquare(index)} onKeyDown={event => move(event, index)}>{index + 1}{gameDay && index === 0 && <span className="sample-now">NOW</span>}</button>;
            })}
          </div>)}
        </div>
        <div className="sample-detail" role="status" aria-live="off">
          <strong>Square {selected + 1} · {nameAt(selected)}</strong>
          <span>Row {selectedRow + 1} · Column {selectedColumn + 1}</span>
          <span>{gameDay ? `KC ${demoBoard.leftAxis[selectedRow]} × PHI ${demoBoard.topAxis[selectedColumn]}` : 'Numbers not drawn'}</span>
          <span className="sample-match-note">{gameDay && selected === 0 ? 'Currently matching' : ''}</span>
          <i key={`${stage}-${selected}`} className="sample-inspection-mark" aria-hidden="true" />
        </div>
        <div className="sr-only" data-testid="sample-inspection-announcement" aria-live="polite" aria-atomic="true">{announcement}</div>
        <div className="sample-inspection-controls" role="group" aria-label="Inspect sample squares">
          <button type="button" className="min-h-11" disabled={selected === 0} onClick={() => { const index = selected - 1; setSelected(index); setAnnouncement(`Square ${index + 1} · ${nameAt(index)}`); }}>Previous square</button>
          <button type="button" className="min-h-11" disabled={selected === 99} onClick={() => { const index = selected + 1; setSelected(index); setAnnouncement(`Square ${index + 1} · ${nameAt(index)}`); }}>Next square</button>
        </div>
        <p className="sample-help">{gameDay ? 'No confirmed quarter results in this illustration. Current matching is not a confirmed winner. Final includes overtime.' : 'Select a square to inspect it. Use arrow keys to move. Names stay in place when game numbers are drawn.'}</p>
        {stage === 'Share' && <Link className="sample-viewer-link min-h-11" to="/demo" onClick={trackViewDemo}>Open sample viewer <span aria-hidden="true">↗</span></Link>}
      </div>
    </section>
  );
}
