import React from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../../../design/primitives';
import { quietLink } from './cta';
import { PrimaryCtaLink } from './PrimaryCtaLink';

const rows = [
  { label: 'Boards, one per seller or family', value: '10' },
  { label: 'Squares on each board', value: '100' },
  { label: 'Squares for sale in all', value: '1,000' },
];

/** The paying customer runs many boards: say so, with the math, before pricing. */
export function FundraiserSection() {
  return (
    <section className="editorial-fundraiser" aria-labelledby="fundraiser-heading">
      <div className="editorial-section editorial-fundraiser-layout">
        <Reveal keepVisible as="header" className="editorial-intro">
          <p className="editorial-kicker">Running a fundraiser?</p>
          <h2 id="fundraiser-heading">Every seller gets a board. One flat price. Zero percent of your squares.</h2>
          <p>Built for booster clubs, schools, churches and youth teams. Each seller gets a link to fill their own squares. Your organization’s name goes on every board, you see them all on one dashboard, and your treasurer gets one receipt.</p>
          <div className="editorial-close-actions">
            <PrimaryCtaLink to="/create" trackCreate>Start your fundraiser boards</PrimaryCtaLink>
            <Link to="/articles/football-squares-fundraiser" className={quietLink}>Read the fundraiser guide</Link>
          </div>
        </Reveal>
        <Reveal keepVisible as="section" className="editorial-fundraiser-math g-float" aria-labelledby="fundraiser-math-heading" delay={60}>
          <p id="fundraiser-math-heading" className="editorial-kicker">Example, not a promise</p>
          <dl>
            {rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
            <div className="is-total"><dt>What GridOne costs for all of them</dt><dd>$79</dd></div>
          </dl>
          <p>You set the price per square, collect the money your way and decide the payouts. GridOne never touches it and never takes a cut.</p>
        </Reveal>
      </div>
    </section>
  );
}
