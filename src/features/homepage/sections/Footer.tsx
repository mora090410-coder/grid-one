import React from 'react';
import { Link } from 'react-router-dom';
import { ghostLink } from './cta';
import { MONEY_BOUNDARY } from '../pricing';

const groups = [
  { title: 'Learn the game', links: [
    ['how-football-squares-work', 'How football squares work'],
    ['digital-football-squares-board-vs-paper', 'Digital board vs paper'],
    ['super-bowl-squares-ideas', 'Super Bowl squares ideas'],
  ] },
  { title: 'Organize your fundraiser', links: [
    ['football-squares-fundraiser', 'Football squares fundraiser'],
    ['youth-sports-football-squares-fundraiser', 'Youth sports fundraiser squares'],
    ['run-your-pool-alternative', 'Run Your Pool alternative'],
  ] },
];

export function Footer() {
  return (
    <footer className="editorial-footer editorial-section">
      <p className="editorial-boundary">{MONEY_BOUNDARY}</p>
      <div className="editorial-footer-guides"><div><p className="editorial-footer-brand">GridOne</p><Link to="/articles" className={ghostLink}>All guides</Link></div>{groups.map(group => <nav key={group.title} aria-label={group.title}><h2>{group.title}</h2><ul>{group.links.map(([slug, label]) => <li key={slug}><Link to={`/articles/${slug}`} className={ghostLink}>{label}</Link></li>)}</ul></nav>)}</div>
      <div className="editorial-footer-legal"><Link to="/login?mode=signin" className={ghostLink}>Sign in</Link><Link to="/privacy" className={ghostLink}>Privacy</Link><Link to="/terms" className={ghostLink}>Terms</Link></div>
    </footer>
  );
}
