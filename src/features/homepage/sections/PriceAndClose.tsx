import React from 'react';
import { Reveal } from '../../../design/primitives';
import { MONEY_BOUNDARY, PRICING } from '../pricing';
import { PrimaryCtaLink } from './PrimaryCtaLink';

const audience = { free: 'One party', gameday: 'A season of games', org: 'Fundraisers and leagues' } as const;
const faq = [
  { q: 'Do viewers need an account?', a: 'No. Viewers open the link without creating an account. Only the organizer signs in. Public viewer links are viewing only.' },
  { q: 'Does GridOne collect square money?', a: `No. ${MONEY_BOUNDARY} Collect by cash, Venmo or your preferred method; payment notes stay private.` },
  { q: 'When do I pay?', a: 'Building is always free. Your first shared board each season is free. Each board counts once, however often you share it. Choose a season plan when you need more boards.' },
];

export function PriceAndClose() {
  return <>
    <section className="compact-pricing compact-section" aria-labelledby="pricing-heading">
      <Reveal keepVisible as="header"><p className="compact-kicker">Simple pricing</p><h2 id="pricing-heading">Your first board is free.</h2></Reveal>
      <section aria-label="Plans" className="compact-plans">{PRICING.map(tier => <div className="compact-plan" key={tier.id}><div><p className="compact-plan-audience">{audience[tier.id]}</p><h3>{tier.name}</h3><p>{tier.detail.replace(/^\$[\d.]+ (?:once|per season) for /, '')}</p></div><div className="compact-price"><strong>{tier.price}</strong><span>{tier.priceNote}</span></div></div>)}</section>
      <p className="compact-plan-includes">Every published board includes live scores, Find my squares, what wins next, winner emails and QR sharing. No percentage of your squares. Ever.</p>
      <div className="compact-pricing-action"><PrimaryCtaLink to="/create" trackCreate>Create your free board</PrimaryCtaLink></div>
    </section>
    <section className="compact-faq compact-section" aria-labelledby="faq-heading"><h2 id="faq-heading">A few things to know</h2><div className="editorial-faq-list">{faq.map(item => <details key={item.q}><summary><span>{item.q}</span><span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div><p className="compact-money">{MONEY_BOUNDARY}</p></section>
  </>;
}
