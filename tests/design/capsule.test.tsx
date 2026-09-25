import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CapsuleButton, CapsuleInput, CapsuleTag } from '../../src/design/primitives/Capsule';

describe('CapsuleButton', () => {
  it('defaults to type=button and primary action styling', () => {
    const onClick = vi.fn();
    render(<CapsuleButton onClick={onClick}>Create your board</CapsuleButton>);
    const btn = screen.getByRole('button', { name: 'Create your board' });
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.className).toContain('bg-action');
    expect(btn.className).toContain('rounded-capsule');
    expect(btn.className).toContain('font-semibold');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('supports quiet and ghost variants', () => {
    render(<><CapsuleButton variant="quiet">Sign in</CapsuleButton><CapsuleButton variant="ghost">Skip</CapsuleButton></>);
    expect(screen.getByRole('button', { name: 'Sign in' }).className).toContain('border-hairline');
    expect(screen.getByRole('button', { name: 'Skip' }).className).toContain('bg-transparent');
  });

  it('is disabled when disabled', () => {
    render(<CapsuleButton disabled>Go live</CapsuleButton>);
    expect(screen.getByRole('button', { name: 'Go live' })).toBeDisabled();
  });
});

describe('CapsuleTag', () => {
  it('renders tones', () => {
    render(<><CapsuleTag>Draft</CapsuleTag><CapsuleTag tone="live">Live</CapsuleTag><CapsuleTag tone="turf">Final</CapsuleTag></>);
    expect(screen.getByText('Live').className).toContain('text-tone-live');
    expect(screen.getByText('Live').className).toContain('whitespace-nowrap');
    expect(screen.getByText('Final').className).toContain('text-tone-turf');
    expect(screen.getByText('Draft').className).toContain('border-hairline');
  });
});

describe('CapsuleInput', () => {
  it('associates the label and forwards value changes', () => {
    const onChange = vi.fn();
    render(<CapsuleInput label="Find my squares" value="" onChange={onChange} placeholder="Your name" />);
    const input = screen.getByLabelText('Find my squares');
    fireEvent.change(input, { target: { value: 'Carrie' } });
    expect(onChange).toHaveBeenCalled();
    expect(input.className).toContain('rounded-capsule');
  });

  it('renders a trailing slot', () => {
    render(<CapsuleInput label="Email" trailing={<CapsuleButton>Notify me</CapsuleButton>} />);
    expect(screen.getByRole('button', { name: 'Notify me' })).toBeInTheDocument();
  });
});
