import React from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../../site/SiteHeader';
import { quietLink, trackViewDemo } from './cta';
import { PrimaryCtaLink } from './PrimaryCtaLink';
import { SampleBoard } from './SampleBoard';
import './hero-studio.css';

export function Hero() {
  return (
    <section data-testid="homepage-first-viewport" className="studio-hero">
      <div className="studio-hero-shell">
        <SiteHeader light />
        <div className="studio-hero-layout">
          <div className="studio-hero-copy">
            <p className="hero-category">Football squares. For the team behind the team.</p>
            <h1 className="studio-hero-title">Your team. <br />One board. <br /><span>Less chasing.</span></h1>
            <p className="studio-hero-description">The football-squares fundraiser for busy team organizers. One viewer link for your group to find their squares and follow game day.</p>
            <div className="studio-hero-actions">
              <PrimaryCtaLink to="/create" trackCreate>Create your free board</PrimaryCtaLink>
              <Link to="/demo" onClick={trackViewDemo} className={quietLink}>Try the demo</Link>
            </div>
            <ul className="studio-hero-reassurance"><li>First published board free each season</li><li>No card required · Sign up when you save</li><li>No account needed to view</li></ul>
            <p className="studio-hero-boundary">For watch parties, office pools, friends, and fundraisers.</p>
          </div>
          <SampleBoard />
        </div>
      </div>
    </section>
  );
}
