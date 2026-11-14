import React from 'react';
import { Reveal } from '../../../design/primitives';

const columns = ['GridOne', 'Paper sheet', 'Free sites', 'Per-grid sites'] as const;
const rows: { label: string; values: [string, string, string, string] }[] = [
  { label: 'Cost for 10 boards', values: ['$79 for the season, up to 50 boards', 'Free', 'Free', 'Charged per grid'] },
  { label: 'Live score and quarter results', values: ['Yes', 'By hand', 'Usually', 'Usually'] },
  { label: 'What wins next, for every viewer', values: ['Yes', 'No', 'Varies', 'Varies'] },
  { label: 'A link for each seller', values: ['Yes', 'No', 'Varies', 'Varies'] },
  { label: 'Your name on every board, one dashboard, one receipt', values: ['Yes, on Organization', 'No', 'Varies', 'Varies'] },
];

export function CompareSection() {
  return (
    <section className="editorial-compare editorial-section" aria-labelledby="compare-heading">
      <Reveal keepVisible as="header" className="editorial-intro">
        <p className="editorial-kicker">How it compares</p>
        <h2 id="compare-heading">More than a paper sheet. Less than paying per grid.</h2>
      </Reveal>
      <div className="editorial-compare-scroll g-float" tabIndex={0} role="region" aria-label="Comparison table">
        <table>
          <thead><tr><td />{columns.map(column => <th key={column} scope="col" className={column === 'GridOne' ? 'is-us' : undefined}>{column}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td key={columns[index]} className={index === 0 ? 'is-us' : undefined}>{value}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="editorial-boundary">Features differ from site to site. GridOne’s first published board each season is free too.</p>
    </section>
  );
}
