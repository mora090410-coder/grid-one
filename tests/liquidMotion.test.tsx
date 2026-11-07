import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Base, CapsuleButton } from '../src/design/primitives';
import { MemoryRouter } from 'react-router-dom';
import { SampleBoard } from '../src/features/homepage/sections/SampleBoard';

it('rolls only the twenty axes when the sample numbers are revealed', () => {
  const { container } = render(<MemoryRouter><SampleBoard /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Game day/ }));
  expect(container.querySelectorAll('.g1-roll-strip')).toHaveLength(20);
});

describe('liquid primary press', () => {
  it('creates three bounded rings on primary buttons and cleans them up', () => {
    vi.useFakeTimers();
    try {
      render(<Base kind="dark" theme="liquid"><CapsuleButton>Save changes</CapsuleButton><button data-cell-index="1">Square</button></Base>);
      const primary = screen.getByRole('button', { name: 'Save changes' });
      fireEvent.pointerDown(primary, { clientX: 20, clientY: 20 });
      expect(primary.querySelectorAll('.g1-ring')).toHaveLength(3);
      fireEvent.pointerDown(screen.getByText('Square'));
      expect(screen.getByText('Square').querySelector('.g1-ring')).toBeNull();
      fireEvent.pointerUp(primary);
      act(() => vi.advanceTimersByTime(1400));
      expect(primary.querySelectorAll('.g1-ring')).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
});
