import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Homepage from '../../src/features/homepage/Homepage';

const renderPage = () => render(<MemoryRouter><Homepage /></MemoryRouter>);

describe('Compact fundraiser workflow', () => {
  it('shows the illustrative organizer summary before pricing, without a generic comparison table', () => {
    renderPage();
    const summary = screen.getByRole('region', { name: 'From setup to game day.' });
    const plans = screen.getByRole('region', { name: 'Plans' });
    expect(summary.compareDocumentPosition(plans) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(summary).getByRole('button', { name: 'Organizer view' }));
    expect(summary).toHaveTextContent('Family A');
    expect(summary).toHaveTextContent('4 squares open');
    expect(summary).toHaveTextContent('Family B');
    expect(summary).toHaveTextContent('2 squares open');
    expect(summary).toHaveTextContent(/sample|illustration|illustrative/i);
    expect(screen.queryByRole('region', { name: 'Comparison table' })).not.toBeInTheDocument();
  });

  it('switches the same compact summary into game day and back without creating data', () => {
    renderPage();
    const summary = screen.getByRole('region', { name: 'From setup to game day.' });
    const organizer = within(summary).getByRole('button', { name: 'Organizer view' });
    const game = within(summary).getByRole('button', { name: 'Game day view' });
    fireEvent.click(game);
    expect(game).toHaveAttribute('aria-pressed', 'true');
    expect(organizer).toHaveAttribute('aria-pressed', 'false');
    expect(summary).toHaveTextContent(/score|matching/i);
    fireEvent.click(organizer);
    expect(organizer).toHaveAttribute('aria-pressed', 'true');
    expect(summary).toHaveTextContent('Family A');
  });

  it('separates public viewing from scoped seller claims in the sharing chapter', () => {
    renderPage();
    const film = screen.getByRole('region', { name: 'Board film' });
    fireEvent.click(within(film).getByRole('button', { name: 'Share' }));
    expect(film).toHaveTextContent(/viewer.*viewing only|viewer.*view only/i);
    expect(film).toHaveTextContent(/seller.*unsold squares/i);
    expect(film).toHaveTextContent(/(?:before|until).*numbers lock/i);
    expect(screen.getAllByRole('link', { name: /fundraiser guide/i }).some(link => link.getAttribute('href') === '/articles/football-squares-fundraiser')).toBe(true);
    expect(screen.getAllByRole('link').some(link => link.getAttribute('href') === '/demo')).toBe(true);
  });
});
