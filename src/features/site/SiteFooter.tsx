import React from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow, Logo } from '../../design/primitives';
import { ghostLink } from '../homepage/sections/cta';

const guides: Array<{ path: string; label: string }> = [
  { path: '/articles/how-football-squares-work', label: 'How football squares work' },
  { path: '/articles/how-to-run-super-bowl-squares', label: 'How to run Super Bowl squares' },
  { path: '/articles/football-squares-fundraiser', label: 'Football squares fundraiser' },
  { path: '/articles/youth-sports-football-squares-fundraiser', label: 'Youth sports fundraiser squares' },
  { path: '/articles/booster-club-football-squares', label: 'Booster club squares' },
  { path: '/articles/church-school-football-squares-fundraiser', label: 'Church and school fundraiser squares' },
  { path: '/articles/office-super-bowl-squares', label: 'Office Super Bowl squares' },
  { path: '/articles/super-bowl-squares-ideas', label: 'Super Bowl squares ideas' },
  { path: '/articles/digital-football-squares-board-vs-paper', label: 'Digital board vs paper' },
  { path: '/articles/nfl-opening-week-squares-pool', label: 'NFL opening week squares' },
  { path: '/articles/football-squares-app', label: 'Football squares app' },
  { path: '/articles/run-your-pool-alternative', label: 'Run Your Pool alternative' },
];

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1200px] px-6 py-12 md:px-12 border-t border-hairline flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Eyebrow>Guides</Eyebrow>
        <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2 md:grid-cols-3">
          {guides.map((g) => (
            <li key={g.path}><Link to={g.path} className={ghostLink}>{g.label}</Link></li>
          ))}
          <li><Link to="/articles" className={ghostLink}>All guides</Link></li>
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Logo variant="horizontal" tone="reversed" size={24} />
        <Link to="/login?mode=signin" className={ghostLink}>Sign in</Link>
        <Link to="/privacy" className={ghostLink}>Privacy</Link>
        <Link to="/terms" className={ghostLink}>Terms</Link>
      </div>
    </footer>
  );
}
