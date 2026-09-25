import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FullScreenLoading from '../../components/loading/FullScreenLoading';
import { SquareOne } from '../../src/design/primitives';

describe('Square One pattern', () => {
  it('renders the loading state with the board pattern, hidden from assistive tech', () => {
    const { container } = render(<FullScreenLoading />);
    const pattern = container.querySelector('[data-square-one]')!;
    expect(pattern).not.toBeNull();
    expect(pattern).toHaveAttribute('aria-hidden', 'true');
    expect(pattern.getAttribute('src')).toContain('gridone-board-pattern-reversed.svg');
    expect(screen.getByRole('status')).toHaveTextContent('Loading GridOne');
  });

  it('uses the chalk pattern on light grounds and the reversed one on ink', () => {
    const { container, rerender } = render(<SquareOne size={96} />);
    expect(container.querySelector('img')!.getAttribute('src')).toContain('gridone-board-pattern.svg');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    rerender(<SquareOne size={96} tone="reversed" />);
    expect(container.querySelector('img')!.getAttribute('src')).toContain('gridone-board-pattern-reversed.svg');
  });

  it('fades in gently, never bounces, and holds still for reduced motion', () => {
    const css = readFileSync('src/design/tokens.css', 'utf8');
    render(<SquareOne />);
    expect(document.querySelector('[data-square-one]')).toHaveClass('g-fade-in');
    const fade = css.slice(css.indexOf('@keyframes g-fade-in'));
    expect(fade.slice(0, fade.indexOf('}\n}') + 3)).not.toMatch(/translate|scale|rotate/);
    const reduced = css.slice(css.lastIndexOf('prefers-reduced-motion: reduce'));
    expect(reduced).toContain('.g-fade-in');
  });
});
