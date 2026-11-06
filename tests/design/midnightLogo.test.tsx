import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import Homepage from '../../src/features/homepage/Homepage';

it('keeps every homepage wordmark readable on the adopted midnight canvas', () => {
  render(<MemoryRouter><Homepage /></MemoryRouter>);
  const logos = screen.getAllByRole('img', { name: 'GridOne' });
  expect(logos.length).toBeGreaterThanOrEqual(2);
  for (const logo of logos) expect(logo.getAttribute('src')).toContain('-white.svg');
});
