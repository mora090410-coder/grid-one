import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Homepage from '../../src/features/homepage/Homepage';
import { MONEY_BOUNDARY } from '../../src/features/homepage/disclosures';

const renderPage = () => render(<MemoryRouter><Homepage /></MemoryRouter>);

describe('Compact cinematic homepage', () => {
  it('keeps the promise, free access, sign-in and demo handoffs in the hero', () => {
    renderPage();
    const hero = screen.getByTestId('homepage-first-viewport');
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent('Your team. One board. Less chasing.');
    expect(within(hero).getByRole('link', { name: 'Create your free board' })).toHaveAttribute('href', '/create');
    expect(within(hero).getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo');
    expect(within(hero).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?mode=signin');
    expect(within(hero).getByText(/Create and publish boards for free/)).toBeInTheDocument();
    expect(within(hero).getByText(/No card required/)).toBeInTheDocument();
  });

  it('retains three explicit cinematic controls without a second full-grid tutorial', () => {
    renderPage();
    const film = screen.getByRole('region', { name: 'Board film' });
    expect(within(film).getByRole('button', { name: 'Game day' })).toHaveAttribute('aria-pressed', 'true');
    for (const stage of ['Build', 'Share', 'Game day']) {
      const button = within(film).getByRole('button', { name: stage });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(within(film).getAllByRole('button').filter(control => control.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    }
    expect(screen.queryByRole('region', { name: 'Interactive sample board' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Comparison table' })).not.toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('shows one sample label without visible interface narration', () => {
    renderPage();
    const film = screen.getByRole('region', { name: 'Board film' });
    expect(within(film).queryByRole('heading', { name: 'Board film' })).not.toBeInTheDocument();
    expect(within(film).getAllByText('Sample game', { exact: true })).toHaveLength(1);
    expect(film).not.toHaveTextContent(/sample board.{0,6}not a live game|simulated score|use the square controls/i);
    expect(screen.queryByText('One board. Two views.', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Simple pricing', { exact: true })).not.toBeInTheDocument();
  });

  it('keeps the example score and current match independent of the square being inspected', () => {
    renderPage();
    const film = within(screen.getByRole('region', { name: 'Board film' }));
    const summary = film.getByTestId('homepage-sample-score');
    expect(summary).toHaveTextContent('KC 17 · PHI 14');
    expect(summary).toHaveTextContent('Taylor M. matches now');
    expect(summary).toHaveTextContent('PHI 4 × KC 7');
    fireEvent.click(film.getByRole('button', { name: 'Next square' }));
    expect(film.getByText(/Square 36/)).toBeInTheDocument();
    expect(summary).toHaveTextContent('Taylor M. matches now');
    fireEvent.click(film.getByRole('button', { name: 'Share' }));
    expect(summary).toHaveTextContent('Sample game');
    expect(summary).not.toHaveTextContent('Taylor M. matches now');
    fireEvent.click(film.getByRole('button', { name: 'Game day' }));
    expect(summary).toHaveTextContent('Taylor M. matches now');
  });

  it('offers a keyboard-equivalent square inspector when the sample is in Game day', () => {
    renderPage();
    const film = screen.getByRole('region', { name: 'Board film' });
    fireEvent.click(within(film).getByRole('button', { name: 'Game day' }));
    const next = within(film).getByRole('button', { name: 'Next square' });
    const previous = within(film).getByRole('button', { name: 'Previous square' });
    const before = film.textContent;
    fireEvent.click(next);
    expect(film.textContent).not.toBe(before);
    fireEvent.click(previous);
    expect(film.textContent).toBe(before);
    expect(film).toHaveTextContent(/sample|simulated/i);
  });

  it('keeps the free board features and create action without billing offers', () => {
    renderPage();
    const closing = screen.getByRole('region', { name: 'Every board is free.' });
    expect(within(closing).queryByRole('region', { name: 'Plans' })).not.toBeInTheDocument();
    expect(closing).not.toHaveTextContent(/\$9\.99|\$79|season plan/i);
    for (const feature of ['live scores', 'Find my squares', 'what wins next', 'winner emails', 'QR sharing']) expect(closing).toHaveTextContent(feature);
    expect(within(closing).getByRole('link', { name: 'Create your free board' })).toHaveAttribute('href', '/create');
  });

  it('uses three closed FAQs and preserves the payment boundary and free access explanation', () => {
    renderPage();
    const questions = ['Do viewers need an account?', 'Does GridOne collect square money?', 'Is GridOne free?'];
    const faq = screen.getByRole('region', { name: 'A few things to know' });
    expect(faq.querySelectorAll('details')).toHaveLength(3);
    for (const question of questions) expect(within(faq).getByText(question).closest('details')?.open).toBe(false);
    const money = within(faq).getByText(questions[1]).closest('details')!;
    fireEvent.click(within(money).getByText(questions[1]));
    expect(money).toHaveTextContent(MONEY_BOUNDARY);
    const payment = within(faq).getByText(questions[2]).closest('details')!;
    fireEvent.click(within(payment).getByText(questions[2]));
    expect(payment).toHaveTextContent(/Create, publish, and share boards for free/i);
    expect(payment).toHaveTextContent(/No card required/i);
  });

  it('opens and closes an FAQ without losing the other questions', () => {
    renderPage();
    const first = screen.getByText('Do viewers need an account?').closest('details')!;
    const summary = first.querySelector('summary')!;
    fireEvent.click(summary);
    expect(first.open).toBe(true);
    expect(first).toHaveTextContent(/Viewers open the link without creating an account/);
    fireEvent.click(summary);
    expect(first.open).toBe(false);
    expect(screen.getByText('Does GridOne collect square money?')).toBeInTheDocument();
    expect(screen.getByText('Is GridOne free?')).toBeInTheDocument();
  });

  it('keeps concise guide and legal exits with the full no-money boundary', () => {
    renderPage();
    const footer = screen.getByRole('contentinfo');
    expect(screen.getByRole('region', { name: 'A few things to know' })).toHaveTextContent(MONEY_BOUNDARY);
    expect(within(footer).getByRole('link', { name: /fundraiser guide/i })).toHaveAttribute('href', '/articles/football-squares-fundraiser');
    expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(within(footer).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });

  it('labels illustrative evidence without invented customer or import claims', () => {
    const { container } = renderPage();
    const copy = container.textContent!;
    expect(copy).toMatch(/Sample game/i);
    expect(copy).not.toMatch(/digitizes it in seconds|(?:perfect|100% accurate) (?:scan|scanning|import)|no review (?:needed|required)/i);
    expect(copy).not.toMatch(/trusted by \d|\d[\d,]* (?:happy customers|paying customers)|(?:customers|teams) have raised \$/i);
  });
});
