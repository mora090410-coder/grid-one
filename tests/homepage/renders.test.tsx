import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Homepage from '../../src/features/homepage/Homepage';

const renderPage = () => render(<MemoryRouter><Homepage /></MemoryRouter>);

describe('Cinematic homepage, static first', () => {
  it('renders a complete static page before any 3D code loads', () => {
    const { container } = renderPage();
    expect(container.querySelector('.cine')).toHaveAttribute('data-mode', 'static');
    const film = screen.getByRole('region', { name: 'How a game day plays out' });
    expect(within(film).getAllByRole('article')).toHaveLength(6);
    expect(film.querySelector('a, button, input, select, textarea')).toBeNull();
  });

  it('states the sample game numbers as ordinary text', () => {
    renderPage();
    const kickoff = screen.getByRole('article', { name: 'The score runs itself.' });
    for (const text of ['KC 17', 'PHI 14', 'Taylor M. matches 7 × 4']) expect(within(kickoff).getByText(text)).toBeInTheDocument();
    const final = screen.getByRole('article', { name: 'Results called. Record kept.' });
    for (const text of ['Q1 J. Rivera', 'Q2 Maya T.', 'Q3 Taylor M.', 'Final Priya S.']) expect(within(final).getByText(text)).toBeInTheDocument();
  });

  it('keeps the hands-on sample board for keyboard and screen-reader visitors', () => {
    renderPage();
    const sample = screen.getByRole('region', { name: 'Interactive sample board' });
    expect(within(sample).getAllByRole('gridcell')).toHaveLength(100);
  });

  it('keeps one main, one h1, and unique ids across all examples', () => {
    const { container } = renderPage();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('data-testid', 'homepage');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const ids = Array.from(container.querySelectorAll('[id]')).map(node => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
