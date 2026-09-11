import React from 'react';
import { Link } from 'react-router-dom';
import { MONEY_BOUNDARY, PRICING, PRICING_SENTENCE } from '../pricing';
import { primaryLink, quietLink } from './cta';

const faq = [
  { q: 'Do viewers need an account?', a: 'No. Viewers open the link without creating an account. Only the organizer signs in.' },
  { q: 'Does GridOne collect square money?', a: `No. ${MONEY_BOUNDARY} Squares and payouts stay between you and your group.` },
  { q: 'When do I pay?', a: 'Building, editing, and previewing are free on every plan, and your first published board each season is free. Sharing your board’s link with players counts as publishing it — but a board only counts once, no matter how often you share or update it. Upgrade when you need more boards.' },
  { q: 'Who can edit the board?', a: 'The organizer controls the board and can give a family a private link to update its assigned names before finalization. Public viewer links cannot edit. Published names change only through a visible, dated correction.' },
];

export function PriceAndClose() {
  return (
    <>
      <section className="editorial-pricing editorial-section" aria-labelledby="pricing-heading">
        <header className="editorial-intro"><p className="editorial-kicker">2026 season</p><h2 id="pricing-heading">Free to start. Ready for your next board.</h2><p>{PRICING_SENTENCE}</p><p className="editorial-boundary">{MONEY_BOUNDARY}</p></header>
        <section aria-label="Plans" className="editorial-plans">
          {PRICING.map(tier => <div className="editorial-plan" key={tier.id}><div><h3>{tier.name}</h3><p>{tier.detail}</p></div><p className={tier.id === 'free' ? 'editorial-price is-free' : 'editorial-price'}><strong>{tier.price}</strong><span>{tier.priceNote}</span></p></div>)}
        </section>
      </section>
      <section className="editorial-faq editorial-section" aria-label="Common questions">
        <div className="editorial-faq-list">
          {faq.map(item => <details key={item.q}><summary className="min-h-11"><span>{item.q}</span><span aria-hidden="true" className="editorial-faq-marker"><span>+</span><span>−</span></span></summary><p>{item.a}</p></details>)}
        </div>
        <div className="editorial-close"><h2>Ready to build the board?</h2><div className="editorial-close-actions"><Link to="/create" className={primaryLink}>Create your free board</Link><Link to="/demo" className={quietLink}>Explore a sample board</Link></div></div>
      </section>
    </>
  );
}
