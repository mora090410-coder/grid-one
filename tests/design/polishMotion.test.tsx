import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrossfadeText } from '../../src/design/primitives/CrossfadeText';
import { DigitFlow, changedDigitFlags } from '../../src/design/primitives/DigitFlow';
import { Enter } from '../../src/design/primitives/Enter';
import { scrollBehavior } from '../../src/design/primitives/motion';

const matchMedia = (matches: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }));
};

describe('changedDigitFlags', () => {
  it('marks only the digits whose place value changed, aligned from the right', () => {
    expect(changedDigitFlags('21', '21')).toEqual([false, false]);
    expect(changedDigitFlags('21', '22')).toEqual([false, true]);
    expect(changedDigitFlags('9', '10')).toEqual([true, true]);
    expect(changedDigitFlags('17', '18')).toEqual([false, true]);
  });
});

describe('scrollBehavior', () => {
  it('uses smooth movement only when motion is allowed', () => {
    expect(scrollBehavior(false)).toBe('smooth');
    expect(scrollBehavior(true)).toBe('instant');
  });
});

describe('Enter', () => {
  it('arms a one-shot entrance when motion is allowed', () => {
    matchMedia(false);
    render(<Enter delay={40}><p>One clear board</p></Enter>);
    const node = screen.getByText('One clear board').parentElement!;
    expect(node).toHaveAttribute('data-enter', 'run');
    expect(node.style.animationDelay).toBe('40ms');
  });

  it('stays at rest under reduced motion', () => {
    matchMedia(true);
    render(<Enter as="h1">Your fundraiser</Enter>);
    const heading = screen.getByRole('heading', { name: 'Your fundraiser' });
    expect(heading).not.toHaveAttribute('data-enter');
    expect(heading).toHaveTextContent('Your fundraiser');
  });
});

describe('DigitFlow', () => {
  it('rolls only the digit that changed', () => {
    matchMedia(false);
    const { rerender } = render(<DigitFlow value={21} />);
    expect(screen.getByText('21').className).not.toContain('digit-flow');
    rerender(<DigitFlow value={22} />);
    const digits = screen.getAllByText('2');
    expect(digits[0].className).not.toContain('digit-flow');
    expect(digits[1].className).toContain('digit-flow');
  });

  it('does not roll under reduced motion', () => {
    matchMedia(true);
    const { rerender } = render(<DigitFlow value={21} />);
    rerender(<DigitFlow value={24} />);
    expect(screen.getByText('24').className).not.toContain('digit-flow');
  });
});

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <button type="button" onClick={() => setValue('KC at PHI')}>Select</button>
      <CrossfadeText value={value} />
    </>
  );
}

describe('CrossfadeText', () => {
  it('keeps the previous line stacked and hidden from the accessible name', () => {
    matchMedia(false);
    render(<Harness initial="Choose your game above" />);
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByText('KC at PHI')).toBeVisible();
    expect(screen.getByText('Choose your game above')).toHaveAttribute('aria-hidden', 'true');
  });

  it('swaps immediately under reduced motion', () => {
    matchMedia(true);
    render(<Harness initial="Choose your game above" />);
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByText('KC at PHI')).toBeVisible();
    expect(screen.queryByText('Choose your game above')).toBeNull();
  });
});
