import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Homepage from '../../src/features/homepage/Homepage';

const tokens = readFileSync('src/design/tokens.css', 'utf8');
const hero = readFileSync('src/features/homepage/sections/hero-studio.css', 'utf8');
const studio = readFileSync('src/features/homepage/studio.css', 'utf8');
const preview = readFileSync('src/features/organizer/create/previewStage.css', 'utf8');
const demo = readFileSync('src/features/viewer/shell/demoStage.css', 'utf8');
const create = readFileSync('pages/CreateContest.tsx', 'utf8');
const cta = readFileSync('src/features/homepage/sections/cta.ts', 'utf8');

describe('marketing stage tokens', () => {
  it('adds a near-black stage and a gold-only action glow without replacing the grounds', () => {
    expect(tokens).toMatch(/--g-stage:\s*#07080B/);
    expect(tokens).toMatch(/--g-ground:\s*#14161D/);
    expect(tokens).toMatch(/--g-ground:\s*#F5F1EA/);
    expect(tokens).toMatch(/--g-cta-glow:\s*color-mix\(in srgb, var\(--g-gold\) 55%, transparent\)/);
    expect(tokens).toContain('.g-cta');
    expect(tokens).toContain('.g-float');
    expect(cta).toContain('g-cta');
    expect(cta).toContain('motion-safe:hover:-translate-y-0.5');
  });

  it('keeps the stage light and the action glow static under reduced motion', () => {
    const reduced = tokens.slice(tokens.lastIndexOf('prefers-reduced-motion: reduce'));
    expect(reduced).toContain('[data-enter="run"]');
    expect(reduced).toContain('[data-match-emphasis="on"]');
    expect(hero).not.toMatch(/@keyframes/);
    expect(studio).not.toMatch(/@keyframes/);
    expect(preview).not.toMatch(/@keyframes/);
    expect(demo).not.toMatch(/@keyframes/);
    expect(preview).toContain('prefers-reduced-motion: reduce');
    expect(demo).toContain('animation: none');
  });
});

describe('marketing chrome does not blur squares', () => {
  it('keeps the create preview on a 10 by 10 opaque grid', () => {
    expect(create).toContain('create-preview-stage');
    expect(create).toContain('data-base="dark"');
    expect(create).toContain('CrossfadeText');
    expect(create).toContain('grid-cols-10');
    expect(create).toContain('aspect-square');
    expect(create).not.toContain('backdrop-blur');
    expect(preview).toContain('backdrop-filter: none');
    expect(preview).not.toMatch(/backdrop-filter:\s*blur/);
  });

  it('frames the demo board without filtering its cells', () => {
    expect(demo).toContain('.board-stage-frame');
    expect(demo).toContain('filter: none');
    expect(demo).toContain('backdrop-filter: none');
    expect(demo).not.toMatch(/backdrop-filter:\s*blur/);
    expect(demo).not.toMatch(/filter:\s*blur/);
  });

  it('renders the homepage hero as dark glass, with the entrance still available', () => {
    render(<MemoryRouter><Homepage /></MemoryRouter>);
    const preparation = screen.getByRole('region', { name: 'Prepare your board' });
    const gameDay = screen.getByRole('region', { name: 'Your group on game day' });
    expect(preparation.className).toContain('g-float');
    expect(gameDay.className).toContain('g-float');
    expect(preparation).not.toHaveAttribute('data-base', 'cream');
    expect(document.querySelector('.editorial-organizer')).not.toHaveAttribute('data-base');
    expect(document.querySelector('.studio-hero-light')).toBeTruthy();
    const hero = screen.getByTestId('homepage-first-viewport');
    expect(within(hero).getByRole('link', { name: 'Create your free board' }).className).toContain('g-cta');
  });
});
