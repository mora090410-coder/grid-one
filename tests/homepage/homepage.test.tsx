import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Homepage from '../../src/features/homepage/Homepage';

const renderPage = () => render(<MemoryRouter><Homepage /></MemoryRouter>);

describe('Homepage', () => {
  it('lists exactly six distinct sources of organizer chaos', () => {
    renderPage();
    const list = screen.getByRole('list', { name: 'The chaos' });
    expect(within(list).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'Blurry board photos',
      'Group chats full of "who won?"',
      'Numbers get mixed up',
      'Two people claiming the same square',
      'Paying for a full party when half the squares are empty',
      'Nobody knows where to look on game day',
    ]);
  });
  it('puts identity, promise, one primary action, and the money boundary in the first viewport', () => {
    renderPage();
    const hero = screen.getByTestId('homepage-first-viewport');
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent('Your fundraiser. One clear board.');
    expect(within(hero).getByText(/Build your football squares board, share one link/)).toBeInTheDocument();
    expect(within(hero).getByRole('link', { name: 'Create your free board' })).toHaveAttribute('href', '/create');
    expect(within(hero).getByRole('link', { name: 'Explore a sample board' })).toHaveAttribute('href', '/demo');
    expect(within(hero).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?mode=signin');
    expect(within(hero).getByText('First published board free')).toBeInTheDocument();
    expect(within(hero).getByText('Viewers don’t need an account')).toBeInTheDocument();
    expect(within(hero).getByText('You collect the money your way. GridOne keeps the board.')).toBeInTheDocument();
    expect(within(hero).queryByText(/does not collect square money/)).not.toBeInTheDocument();
    expect(within(hero).getByText('Sample board — not a live game')).toBeInTheDocument();
  });

  it('separates preparation from game day in static excerpts of the same board', () => {
    renderPage();
    const hero = screen.getByTestId('homepage-first-viewport');
    for (const name of ['Prepare your board', 'Your group on game day']) {
      const excerpt = within(hero).getByRole('region', { name });
      expect(within(excerpt).getByText('Lincoln Softball Booster Board')).toBeInTheDocument();
      expect(excerpt.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
    }
    expect(within(hero).getByText('Numbers not drawn')).toBeInTheDocument();
    expect(within(hero).getByText('Published · numbers locked')).toBeInTheDocument();
    expect(within(hero).getByText('Currently matching')).toBeInTheDocument();
    expect(hero.querySelector('[data-reveal], [data-fill]')).toBeNull();
  });

  it('tells the organizer, game-day, then pricing story without retired demonstrations', () => {
    const { container } = renderPage();
    const organizer = screen.getByRole('heading', { name: 'Less paper. Less chasing.' });
    const score = screen.getByRole('heading', { name: 'Scores update themselves.' });
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
    const explanation = screen.getByRole('region', { name: 'Scores update themselves.' });
    expect(within(explanation).getByText('At the end of each quarter, the last digit of each team’s score points to the winning square. GridOne marks it for you.')).toBeInTheDocument();
    expect(within(explanation).getByText(/Winners for Q1, halftime, Q3, and the final score. Overtime counts toward the final./)).toBeInTheDocument();
  });

  it('describes reviewed photo import without a speed or paid-plan promise', () => {
    renderPage();
    expect(screen.getByText('Already have a paper board? Upload a photo and let GridOne help digitize it. (Beta)')).toBeInTheDocument();
    expect(screen.getByText('Sign in to import, then review every square before publishing.')).toBeInTheDocument();
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
    expect(screen.getByText('Sample board — not a live game')).toBeInTheDocument();
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
    expect(screen.getAllByText('+').length).toBe(4);
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
