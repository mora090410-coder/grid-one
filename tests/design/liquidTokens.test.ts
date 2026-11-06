import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = 'src/design/liquid/tokens.css';
const css = () => existsSync(path) ? readFileSync(path, 'utf8') : '';

describe('liquid glass slice 1: inert scoped tokens', () => {
  it('loads the new token sheet once without changing existing root tokens', () => {
    expect(readFileSync('src/index.css', 'utf8').split('@import "./design/liquid/tokens.css";')).toHaveLength(2);
    expect(css()).toContain('[data-g1-theme="liquid"]');
    expect(css()).not.toMatch(/:root\s*\{/);
    expect(css()).not.toMatch(/\b(background|color|font-family)\s*:/);
  });
  it('matches the approved semantic palette and ownership tints', () => {
    const palette = { ground:'#070B14', midnight:'#10182A', 'channel-a':'#22324C', 'channel-b':'#121B2C', chalk:'#E9ECF2', muted:'#A9B4C6', faint:'#8C9AB0', gold:'#B7A477', 'gold-lit':'#E8D39B', 'gold-hi':'#FFF3CF', live:'#E5734F', 'seller-1':'#5FA8A0', 'seller-2':'#A894D6', 'seller-3':'#D08A6A', 'seller-4':'#8FB27A', 'seller-5':'#7FA6D9', 'seller-6':'#D58AA0' };
    for (const [role, value] of Object.entries(palette)) expect(css(),role).toContain(`--g1-${role}: ${value};`);
    expect(css()).toContain('--g1-font: "Inter", system-ui, sans-serif;');
  });
  it('is valid CSS and exposes tokens only on the opt-in surface', () => {
    const style = document.createElement('style'); style.textContent = css(); document.head.append(style);
    const surface = document.createElement('div'); surface.dataset.g1Theme = 'liquid'; document.body.append(surface);
    expect(getComputedStyle(surface).getPropertyValue('--g1-ground').trim()).toBe('#070B14');
    expect(getComputedStyle(document.documentElement).getPropertyValue('--g1-ground')).toBe('');
    style.remove(); surface.remove();
  });
});
