import React from 'react';
import './studio.css';
import { Base } from '../../design/primitives';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';
import { OrganizerSection } from './sections/OrganizerSection';
import { PriceAndClose } from './sections/PriceAndClose';
import { ScoreSection } from './sections/ScoreSection';

export default function Homepage() {
  return (
    <Base kind="dark" className="marketing-stage overflow-x-clip">
      <main data-testid="homepage">
        <Hero />
        <OrganizerSection />
        <ScoreSection />
        <PriceAndClose />
      </main>
      <Footer />
    </Base>
  );
}
