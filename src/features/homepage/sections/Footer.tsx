import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../../design/primitives';

export function Footer() {
  return <footer className="compact-footer compact-section"><Logo variant="horizontal" tone="white" size={28} /><nav aria-label="Guides and policies"><Link to="/articles/football-squares-fundraiser">Fundraiser guide</Link><Link to="/articles/how-football-squares-work">How to play</Link><Link to="/articles">All guides</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/login?mode=signin">Sign in</Link></nav></footer>;
}
