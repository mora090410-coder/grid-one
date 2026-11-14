import React from 'react';
import { Reveal } from '../../../design/primitives';
import { SampleBoard } from './SampleBoard';
import './hero-studio.css';

/** The hands-on sample board: works with a keyboard, screen readers and touch. */
export function TrySampleSection() {
  return (
    <section className="editorial-try editorial-section" aria-labelledby="try-heading">
      <Reveal keepVisible as="header" className="editorial-intro">
        <p className="editorial-kicker">Try it yourself</p>
        <h2 id="try-heading">Pick a square. See where it lands.</h2>
        <p>Move through a sample board from setup to game day. Nothing here is saved or shared.</p>
      </Reveal>
      <div className="editorial-try-board"><SampleBoard /></div>
    </section>
  );
}
