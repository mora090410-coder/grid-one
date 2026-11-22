import React from 'react';
import { Reveal } from '../../../design/primitives';
import { MONEY_BOUNDARY } from '../disclosures';
import { PrimaryCtaLink } from './PrimaryCtaLink';

const faq = [
  { q: 'Do viewers need an account?', a: 'No. Viewers open the link without creating an account. Only the organizer signs in. Public viewer links are viewing only.' },
  { q: 'Does GridOne collect square money?', a: `No. ${MONEY_BOUNDARY} Collect by cash, Venmo or your preferred method; payment notes stay private.` },
  { q: 'Is GridOne free?', a: 'Yes. Create, publish, and share boards for free. No card required. Organizers sign up when they save a board.' },
];

export function FreeAccessClose() {
  return <>
    <section className="compact-free-access compact-section" aria-labelledby="free-access-heading">
      <Reveal keepVisible as="header"><h2 id="free-access-heading">Every board is free.</h2></Reveal>
      <p className="compact-free-features">Every published board includes live scores, Find my squares, what wins next, optional winner emails and QR sharing. No card required.</p>
      <div className="compact-free-access-action"><PrimaryCtaLink to="/create" trackCreate>Create your free board</PrimaryCtaLink></div>
    </section>
    <section className="compact-faq compact-section" aria-labelledby="faq-heading"><h2 id="faq-heading">A few things to know</h2><div className="editorial-faq-list">{faq.map(item => <details key={item.q}><summary><span>{item.q}</span><span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div><p className="compact-money">{MONEY_BOUNDARY}</p></section>
  </>;
}
