import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Homepage from '../../src/features/homepage/Homepage';

const renderPage = () => render(<MemoryRouter><Homepage /></MemoryRouter>);

describe('fundraiser buyer and comparison', () => {
  it('speaks to many-board fundraisers after the game-day story and before pricing', () => {
    renderPage();
    const fundraiser = screen.getByRole('heading', { name: 'Every seller gets a board. One flat price. Zero percent of your squares.' });
    const score = screen.getByRole('heading', { name: 'Know what to root for.' });
    const plans = screen.getByRole('region', { name: 'Plans' });
    expect(score.compareDocumentPosition(fundraiser) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fundraiser.compareDocumentPosition(plans) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start your fundraiser boards' })).toHaveAttribute('href', '/create');
    expect(screen.getByRole('link', { name: 'Read the fundraiser guide' })).toHaveAttribute('href', '/articles/football-squares-fundraiser');
  });

  it('labels the example math as an example and quotes only the real Organization price', () => {
    renderPage();
    const math = screen.getByRole('region', { name: 'Example, not a promise' });
    expect(within(math).getByText('$79')).toBeInTheDocument();
    expect(within(math).getByText(/never takes a cut/)).toBeInTheDocument();
    expect(math.textContent).not.toMatch(/raise|guarantee/i);
  });

  it('compares in an accessible table with GridOne first', () => {
    renderPage();
    const table = within(screen.getByRole('region', { name: 'Comparison table' })).getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map(cell => cell.textContent);
    expect(headers).toEqual(['GridOne', 'Paper sheet', 'Free sites', 'Per-grid sites']);
    expect(within(table).getByRole('rowheader', { name: 'A link for each seller' })).toBeInTheDocument();
  });

  it('names who each plan is for and answers payment-method and game questions', () => {
    renderPage();
    const plans = screen.getByRole('region', { name: 'Plans' });
    for (const label of ['One party', 'A season of games', 'Fundraisers and leagues']) expect(within(plans).getByText(label)).toBeInTheDocument();
    expect(screen.getByText('No percentage of your squares. Ever.', { exact: false })).toBeInTheDocument();
    for (const q of ['Can I collect by Venmo, cash or check?', 'Can I run more than one board?', 'Which games can I use?']) expect(screen.getByText(q).closest('details')?.open).toBe(false);
  });
});
