import React from 'react';
import './studio.css';
import { Base } from '../../design/primitives';
import GlassGridBackground from '../../design/liquid/GlassGridBackground';
import '../../design/liquid/homepage.css';
import { CinematicHomepage } from './cinematic/CinematicHomepage';
import { Footer } from './sections/Footer';
import { TrySampleSection } from './sections/TrySampleSection';
import { FundraiserSection } from './sections/FundraiserSection';
import { CompareSection } from './sections/CompareSection';
import { PriceAndClose } from './sections/PriceAndClose';

export default function Homepage() {
  return (
    <Base kind="dark" theme="liquid" className="g1-page g1-homepage g-editorial marketing-stage overflow-x-clip">
      <GlassGridBackground />
      <main data-testid="homepage">
        <CinematicHomepage />
        <TrySampleSection />
        <FundraiserSection />
        <CompareSection />
        <PriceAndClose />
      </main>
      <Footer />
    </Base>
  );
}
