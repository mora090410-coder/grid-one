import { readFileSync, readdirSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo, type LogoTone, type LogoVariant } from '../../src/design/primitives';

const VARIANTS: LogoVariant[] = ['mark', 'horizontal', 'stacked'];
const TONES: LogoTone[] = ['color', 'reversed', 'black', 'white'];
const FILE_STEM = { mark: 'gridone-mark', horizontal: 'gridone-lockup-horizontal', stacked: 'gridone-lockup-stacked' };

describe('Logo', () => {
  for (const variant of VARIANTS) {
    for (const tone of TONES) {
      it(`renders the ${variant} ${tone} logo from its brand SVG with the name GridOne`, () => {
        render(<Logo variant={variant} tone={tone} size={40} />);
        const logo = screen.getByRole('img', { name: 'GridOne' });
        expect(logo).toHaveAttribute('aria-label', 'GridOne');
        expect(logo.getAttribute('src')).toContain(`${FILE_STEM[variant]}-${tone}.svg`);
        expect(logo).toHaveAttribute('height', '40');
      });
    }
  }

  it('defaults to the color mark', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'GridOne' }).getAttribute('src')).toContain('gridone-mark-color.svg');
  });

  it('keeps the width in the lockup proportion so the logo never distorts', () => {
    render(<Logo variant="horizontal" size={32} />);
    // viewBox 393.285 x 104
    expect(screen.getByRole('img', { name: 'GridOne' })).toHaveAttribute('width', String(Math.round((32 * 393.2851311953352) / 104)));
  });

  it('draws every logo file from the same G stroke and gold corner', () => {
    const files = readdirSync('src/assets/brand').filter((name) => /^gridone-(mark|lockup)-/.test(name));
    expect(files).toHaveLength(12);
    for (const name of files) {
      const svg = readFileSync(`src/assets/brand/${name}`, 'utf8');
      expect(svg, name).toContain('<path d="M76 29H29V91H91V61H61"');
      expect(svg, name).toContain('<rect x="84" y="22" width="14" height="14"');
    }
  });
});
