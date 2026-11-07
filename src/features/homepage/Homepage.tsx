import React from 'react';
import './studio.css';
import { Base } from '../../design/primitives';
import GlassGridBackground from '../../design/liquid/GlassGridBackground';
import '../../design/liquid/homepage.css';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';
import { OrganizerSection } from './sections/OrganizerSection';
import { PriceAndClose } from './sections/PriceAndClose';
import { ScoreSection } from './sections/ScoreSection';

export default function Homepage() {
  return (
    <Base kind="dark" theme="liquid" className="g1-page g1-homepage g-editorial marketing-stage overflow-x-clip">
      <GlassGridBackground />
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
