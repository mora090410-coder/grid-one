import React from 'react';
import './studio.css';
import { Base } from '../../design/primitives';
import '../../design/liquid/homepage.css';
import { CinematicHomepage } from './cinematic/CinematicHomepage';
import { Footer } from './sections/Footer';
import { CompactWorkflow } from './sections/CompactWorkflow';
import './compact.css';
import { PriceAndClose } from './sections/PriceAndClose';

export default function Homepage() {
  return (
    <Base kind="dark" theme="liquid" className="g1-page g1-homepage g-editorial marketing-stage overflow-x-clip">
      <main data-testid="homepage">
        <CinematicHomepage />
        <CompactWorkflow />
        <PriceAndClose />
      </main>
      <Footer />
    </Base>
  );
}
