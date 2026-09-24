import React from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../../../design/primitives';
import { MONEY_BOUNDARY, PRICING, PRICING_SENTENCE } from '../pricing';
import { quietLink, trackViewDemo } from './cta';
import { PrimaryCtaLink } from './PrimaryCtaLink';

const faq = [
  { q: 'Do viewers need an account?', a: 'No. Viewers open the link without creating an account. Only the organizer signs in.' },
  { q: 'Does GridOne collect square money?', a: `No. ${MONEY_BOUNDARY} Squares and payouts stay between you and your group.` },
  { q: 'When do I pay?', a: 'Building is always free. Your first shared board each season is free. Each board counts once, however often you share it.' },
  { q: 'Who can edit the board?', a: 'You control the board. You can give a family a private link to add names to its own squares. Viewers can’t edit, and any fix after the numbers lock is shown to everyone.' },
];

export function PriceAndClose() {
  return (
    <>
      <section className="editorial-pricing editorial-section" aria-labelledby="pricing-heading">
        <Reveal as="header" className="editorial-intro"><p className="editorial-kicker">2026 season</p><h2 id="pricing-heading">Free to start. Ready for your next board.</h2><p>{PRICING_SENTENCE}</p></Reveal>
        <Reveal as="section" aria-label="Plans" className="editorial-plans" delay={60}>
          {PRICING.map(tier => <div className="editorial-plan g-float" key={tier.id}><div><h3>{tier.name}</h3><p>{tier.detail}</p></div><p className={tier.id === 'free' ? 'editorial-price is-free' : 'editorial-price'}><strong>{tier.price}</strong><span>{tier.priceNote}</span></p></div>)}
        </Reveal>
      </section>
      <section className="editorial-faq editorial-section" aria-label="Common questions">
        <Reveal keepVisible className="editorial-faq-list">
          {faq.map(item => <details key={item.q}><summary className="min-h-11"><span>{item.q}</span><span aria-hidden="true" className="editorial-faq-marker"><span>+</span><span>−</span></span></summary><p>{item.a}</p></details>)}
        </Reveal>
        <div className="editorial-close"><h2>Ready to build the board?</h2><div className="editorial-close-actions"><PrimaryCtaLink to="/create" trackCreate>Create your free board</PrimaryCtaLink><Link to="/demo" onClick={trackViewDemo} className={quietLink}>Explore a sample board</Link></div></div>
      </section>
    </>
  );
}
