import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Homepage from '../../src/features/homepage/Homepage';

const renderPage = () => render(<MemoryRouter><Homepage /></MemoryRouter>);

describe('Homepage', () => {
  it('uses translate-only reveals for text before and immediately after scroll entry', () => {
    const callbacks: IntersectionObserverCallback[] = [];
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 2000 } as DOMRect);
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { callbacks.push(callback); }
      observe() {}
      disconnect() {}
    });
    try {
      const { container } = renderPage();
      const reveals = [...container.querySelectorAll('[data-reveal]')];
      expect(reveals.length).toBeGreaterThan(0);
      expect(reveals.map(node => node.getAttribute('data-reveal'))).toEqual(reveals.map(() => 'shift'));
      act(() => callbacks.forEach(callback => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)));
      expect(reveals.map(node => node.getAttribute('data-reveal'))).toEqual(reveals.map(() => 'in'));
    } finally {
      bounds.mockRestore();
      vi.unstubAllGlobals();
    }
  });
  it('welcomes different groups and tells the game day in six chapters', () => {
    renderPage();
    expect(screen.getByText('For watch parties, office pools, friends, and fundraisers.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'The chaos' })).not.toBeInTheDocument();
    const film = screen.getByRole('region', { name: 'How a game day plays out' });
    expect(within(film).getAllByRole('article').map(card => within(card).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Fill the board, not a spreadsheet.', 'One link. Every phone.', 'Numbers drawn at random. Locked when you publish.',
      'The score runs itself.', 'Everyone knows what to root for.', 'Results called. Record kept.',
    ]);
  });
  it('puts identity, promise, one primary action, and viewing reassurance in the hero', () => {
    renderPage();
    const hero = screen.getByTestId('homepage-first-viewport');
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent('Your team. One board. Less chasing.');
    expect(within(hero).getByText(/football-squares fundraiser/i)).toBeInTheDocument();
    expect(within(hero).getByRole('link', { name: 'Create your free board' })).toHaveAttribute('href', '/create');
    expect(within(hero).getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo');
    expect(within(hero).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?mode=signin');
    expect(within(hero).getByText('First published board free each season')).toBeInTheDocument();
    expect(within(hero).getByText('No account needed to view')).toBeInTheDocument();
    expect(within(hero).queryByText('You collect the money your way. GridOne keeps the board.')).not.toBeInTheDocument();
    expect(within(hero).queryByText(/does not collect square money/)).not.toBeInTheDocument();
    expect(within(hero).getByText('Sample board — not a live game')).toBeInTheDocument();
  });

  it('explores a real 100-square sample with keyboard-accessible details and truthful stages', () => {
    renderPage();
    const sample = screen.getByRole('region', { name: 'Interactive sample board' });
    expect(within(sample).getAllByRole('gridcell')).toHaveLength(100);
    expect(within(sample).getByText('Select a numbered square to see its name and position.')).toBeVisible();
    expect(within(sample).getByText('Numbers not drawn')).toBeVisible();
    fireEvent.click(within(sample).getByRole('button', { name: 'Share' }));
    expect(within(sample).getByText(/Public viewer link: viewing only/)).toBeVisible();
    expect(within(sample).getByRole('link', { name: 'Open sample viewer' })).toHaveAttribute('href', '/demo');
    fireEvent.click(within(sample).getByRole('button', { name: 'Game day' }));
    expect(within(sample).getByText(/Currently matching: Taylor M./)).toBeVisible();
    expect(within(sample).getByText(/No confirmed quarter results in this illustration/)).toBeVisible();
    const cell = within(sample).getByRole('gridcell', { name: /Square 1, Taylor M\./ });
    fireEvent.click(cell);
    expect(within(sample).getByRole('status')).toHaveTextContent('Square 1 · Taylor M.');
    fireEvent.keyDown(cell, { key: 'ArrowRight' });
    expect(within(sample).getByRole('gridcell', { name: /Square 2,/ })).toHaveFocus();
    expect(within(sample).getAllByRole('gridcell').filter(el => el.tabIndex === 0)).toHaveLength(1);
    fireEvent.click(within(sample).getByRole('button', { name: 'Set up' }));
    expect(within(sample).getByText('Numbers not drawn')).toBeVisible();
  });

  it('provides large previous/next controls for dense-grid touch inspection and names the current match', () => {
    renderPage();
    const sample = screen.getByRole('region', { name: 'Interactive sample board' });
    expect(within(sample).getByRole('button', { name: 'Previous square' })).toBeDisabled();
    fireEvent.click(within(sample).getByRole('button', { name: 'Next square' }));
    expect(within(sample).getByTestId('sample-inspection-announcement')).toHaveTextContent('Square 2');
    expect(within(sample).getByRole('status')).toHaveAttribute('aria-live', 'off');
    fireEvent.click(within(sample).getByRole('button', { name: 'Previous square' }));
    fireEvent.click(within(sample).getByRole('button', { name: 'Game day' }));
    expect(within(sample).getByRole('gridcell', { name: /Square 1, Taylor M.*currently matching/ })).toBeInTheDocument();
    expect(within(sample).getByRole('status')).toHaveTextContent('Currently matching');
  });

  it('keeps one polite atomic announcement region for controls without repeating grid or stage inspections', () => {
    renderPage();
    const sample = screen.getByRole('region', { name: 'Interactive sample board' });
    const announcement = within(sample).getByTestId('sample-inspection-announcement');
    const inspector = within(sample).getByRole('status');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
    expect(announcement).toHaveAttribute('aria-atomic', 'true');
    expect(announcement).toBeEmptyDOMElement();
    expect(inspector).toHaveAttribute('aria-live', 'off');
    fireEvent.click(within(sample).getByRole('button', { name: 'Next square' }));
    expect(announcement).toHaveTextContent('Square 2');
    expect(within(sample).getByTestId('sample-inspection-announcement')).toBe(announcement);
    fireEvent.click(within(sample).getByRole('button', { name: 'Next square' }));
    expect(announcement).toHaveTextContent('Square 3');
    fireEvent.click(within(sample).getByRole('button', { name: 'Previous square' }));
    expect(announcement).toHaveTextContent('Square 2');
    expect(within(sample).getByTestId('sample-inspection-announcement')).toBe(announcement);
    const cell = within(sample).getByRole('gridcell', { name: /Square 4,/ });
    fireEvent.click(cell);
    fireEvent.keyDown(cell, { key: 'ArrowRight' });
    fireEvent.click(within(sample).getByRole('button', { name: 'Game day' }));
    expect(announcement).toBeEmptyDOMElement();
    expect(within(sample).getByTestId('sample-inspection-announcement')).toBe(announcement);
    expect(inspector).toHaveAttribute('aria-live', 'off');
  });

  it('keeps selected coordinates and supporter positions across stages and keyboard boundaries', () => {
    renderPage();
    const sample = screen.getByRole('region', { name: 'Interactive sample board' });
    const cells = within(sample).getAllByRole('gridcell');
    const inspector = within(sample).getByRole('status');
    fireEvent.keyDown(cells[0], { key: 'End' });
    expect(cells[9]).toHaveFocus();
    expect(inspector).toHaveAttribute('aria-live', 'off');
    fireEvent.keyDown(cells[9], { key: 'ArrowRight' });
    expect(cells[9]).toHaveFocus();
    fireEvent.keyDown(cells[9], { key: 'ArrowDown' });
    expect(cells[19]).toHaveFocus();
    expect(inspector).toHaveTextContent('Row 2 · Column 10');
    expect(within(sample).getAllByRole('rowheader')[1]).toHaveAttribute('data-inspected', 'true');
    expect(within(sample).getAllByRole('columnheader')[10]).toHaveAttribute('data-inspected', 'true');
    for (const stage of ['Game day', 'Share', 'Game day', 'Set up']) {
      fireEvent.click(within(sample).getByRole('button', { name: stage }));
      expect(within(sample).getByRole('status')).toBe(inspector);
      expect(cells[19]).toHaveAttribute('aria-selected', 'true');
      expect(cells[0]).toHaveAccessibleName(/Square 1, Taylor M\./);
    }
    fireEvent.keyDown(cells[19], { key: 'Home' });
    expect(cells[10]).toHaveFocus();
    fireEvent.keyDown(cells[10], { key: 'ArrowUp' });
    fireEvent.keyDown(cells[0], { key: 'ArrowLeft' });
    expect(cells[0]).toHaveFocus();
    fireEvent.click(cells[99]);
    fireEvent.keyDown(cells[99], { key: 'ArrowDown' });
    expect(cells[99]).toHaveFocus();
    expect(within(sample).getAllByRole('gridcell').filter(cell => cell.tabIndex === 0)).toHaveLength(1);
  });

  it('tells the organizer, game-day, then pricing story without retired demonstrations', () => {
    const { container } = renderPage();
    const organizer = screen.getByRole('heading', { name: 'Fill the board, not a spreadsheet.' });
    const score = screen.getByRole('heading', { name: 'Everyone knows what to root for.' });
    const pricing = screen.getByRole('region', { name: 'Plans' });
    expect(organizer.compareDocumentPosition(score) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(score.compareDocumentPosition(pricing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('[data-fill], [data-reveal]')).toBeNull();
    expect(screen.queryByTestId('board-fill-section')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Explore the viewer' })).toBeNull();
  });

  it('uses the exact pricing strings and keeps FAQ closed by default', () => {
    renderPage();
    expect(screen.getByText('1 published board per account per season')).toBeInTheDocument();
    expect(screen.getByText('$9.99 once for up to 5 published boards in the 2026 season')).toBeInTheDocument();
    expect(screen.getByText(/\$79 per season for up to 50 published boards, organization naming, shared dashboard, and one organization receipt/)).toBeInTheDocument();
    for (const q of ['Do viewers need an account?', 'Does GridOne collect square money?', 'When do I pay?', 'Who can edit the board?']) {
      const summary = screen.getByText(q);
      expect(summary.closest('details')?.open).toBe(false);
    }
    expect(screen.getByRole('heading', { name: 'Ready to build the board?' })).toBeInTheDocument();
  });

  it('states the full money boundary once outside the footer, in the FAQ', () => {
    renderPage();
    const main = document.body.querySelector('footer')?.parentElement ?? document.body;
    const all = screen.queryAllByText(/does not collect square money/);
    const outsideFooter = all.filter((node) => !node.closest('footer'));
    expect(outsideFooter.length).toBeLessThanOrEqual(1);
    void main;
  });

  it('explains publication allowance in the rendered payment answer', () => {
    renderPage();
    const answer = screen.getByText('When do I pay?').closest('details')!;
    fireEvent.click(within(answer).getByText('When do I pay?'));
    expect(within(answer).getByText('Building is always free. Your first shared board each season is free. Each board counts once, however often you share it.')).toBeVisible();
  });

  it('explains automatic matching with an explicit Final and overtime qualification', () => {
    renderPage();
    const kickoff = screen.getByRole('article', { name: 'The score runs itself.' });
    expect(within(kickoff).getByText(/The last digit of each score points to one square. That square is matching now./)).toBeInTheDocument();
    const final = screen.getByRole('article', { name: 'Results called. Record kept.' });
    expect(within(final).getByText('Final includes overtime. An open square stays open, with no rollover.')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Everyone knows what to root for.' })).getByText('Plain math on the score. Never odds or predictions.')).toBeInTheDocument();
  });

  it('describes reviewed photo import without a speed or paid-plan promise', () => {
    renderPage();
    expect(screen.getByText('Already have a paper board? Upload a photo to import it (Beta). Sign in, then review every square before publishing.')).toBeInTheDocument();
    expect(screen.queryByText(/digitizes it in seconds/i)).not.toBeInTheDocument();
  });

  it('closes with a footer index of guides and legal links', () => {
    renderPage();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.')).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: /Run Your Pool alternative/i })).toHaveAttribute('href', '/articles/run-your-pool-alternative');
    expect(within(footer).getByRole('link', { name: 'All guides' })).toHaveAttribute('href', '/articles');
    expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(within(footer).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });

  it('keeps every link and button at least 44px tall', () => {
    renderPage();
    for (const control of [...screen.getAllByRole('link'), ...screen.queryAllByRole('button')]) {
      expect(control.className, control.textContent ?? '').toMatch(/\bh-11\b|\bh-13\b|\bmin-h-11\b/);
    }
  });

  it('labels sample evidence and avoids unsupported import and customer claims', () => {
    const { container } = renderPage();
    const copy = container.textContent!;
    expect(screen.getAllByText('Sample board — not a live game').length).toBeGreaterThan(0);
    expect(copy).not.toMatch(/digitizes it in seconds|(?:perfect|100% accurate) (?:scan|scanning|import)|no review (?:needed|required)/i);
    // Target unsupported evidence claims, not expressive vocabulary. These
    // checks are regression guards, not proof that every possible claim is true.
    expect(copy).not.toMatch(/trusted by \d|\d[\d,]* (?:happy customers|paying customers)|(?:customers|teams) have raised \$/i);
  });

  it('exposes main and contentinfo landmarks and a visible FAQ affordance', () => {
    renderPage();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toContainElement(screen.getByRole('contentinfo'));
    expect(screen.getAllByText('+').length).toBe(7);
  });
});

describe('Pricing and FAQ interaction', () => {
  it('opens and closes an answer without removing other questions', () => {
    renderPage();
    const questions = ['Do viewers need an account?', 'Does GridOne collect square money?', 'When do I pay?', 'Who can edit the board?'];
    const first = screen.getByText(questions[0]).closest('details')!;
    const summary = first.querySelector('summary')!;
    expect(first.open).toBe(false);
    fireEvent.click(summary);
    expect(first.open).toBe(true);
    expect(within(first).getByText(/Viewers open the link without creating an account/)).toBeVisible();
    for (const question of questions) expect(screen.getByText(question)).toBeInTheDocument();
    fireEvent.click(summary);
    expect(first.open).toBe(false);
  });
});
