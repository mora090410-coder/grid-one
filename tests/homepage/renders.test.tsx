import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Homepage from '../../src/features/homepage/Homepage';

const renderPage = () => render(<MemoryRouter><Homepage /></MemoryRouter>);

describe('Compact cinematic homepage, static first', () => {
  it('renders usable controls and content without a WebGL context', () => {
    const { container } = renderPage();
    expect(container.querySelector('.cine')).toHaveAttribute('data-mode', 'static');
    const film = screen.getByRole('region', { name: 'Board film' });
    for (const name of ['Build', 'Share', 'Game day']) {
      const control = within(film).getByRole('button', { name });
      fireEvent.click(control);
      expect(control).toHaveAttribute('aria-pressed', 'true');
      expect(film.textContent!.length).toBeGreaterThan(50);
    }
    expect(screen.getAllByRole('link', { name: 'Create your free board' }).length).toBeGreaterThan(1);
  });

  it('keeps sample score and matching information available as text', () => {
    renderPage();
    const film = screen.getByRole('region', { name: 'Board film' });
    fireEvent.click(within(film).getByRole('button', { name: 'Game day' }));
    expect(film).toHaveTextContent(/KC\s*17/);
    expect(film).toHaveTextContent(/PHI\s*14/);
    expect(film).toHaveTextContent(/Taylor M\./);
    expect(film).toHaveTextContent(/matching|matches/i);
    expect(film).toHaveTextContent(/sample|simulated/i);
    expect(film).not.toHaveTextContent(/tap a tile/i);
  });

  it('keeps one main, one h1, and unique ids across the compact examples', () => {
    const { container } = renderPage();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('main')).not.toContainElement(screen.getByRole('contentinfo'));
    const ids = Array.from(container.querySelectorAll('[id]')).map(node => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
