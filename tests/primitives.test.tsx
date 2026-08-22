import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionButton } from '../components/primitives/ActionButton';
import { Dialog } from '../components/primitives/Dialog';
import { Field } from '../components/primitives/Field';

describe('ActionButton', () => {
  it('renders a semantic 44px-capable button with forwarded ref and default button type', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<ActionButton ref={ref}>Find</ActionButton>);

    const button = screen.getByRole('button', { name: 'Find' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('oa-btn');
    expect(button.className).toContain('min-h-11');
    expect(ref.current).toBe(button);
  });

  it('uses real disabled and busy semantics without invoking clicks', () => {
    const onClick = vi.fn();
    render(<ActionButton busy onClick={onClick}>Copying…</ActionButton>);

    const button = screen.getByRole('button', { name: 'Copying…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not let caller aria-busy override controlled busy state', () => {
    render(<ActionButton busy aria-busy="false">Saving</ActionButton>);
    expect(screen.getByRole('button', { name: 'Saving' })).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Field', () => {
  it('binds label, description, error, invalid state, and forwarded input ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <Field
        ref={ref}
        id="viewer-player-search"
        label="Name used on board"
        description="Use the organizer-entered name."
        error="Required"
      />,
    );

    const field = screen.getByLabelText('Name used on board');
    expect(field).toBeInvalid();
    expect(field).toHaveAttribute('aria-describedby', 'viewer-player-search-description viewer-player-search-error');
    expect(screen.getByText('Use the organizer-entered name.')).toHaveAttribute('id', 'viewer-player-search-description');
    expect(screen.getByText('Required')).toHaveAttribute('id', 'viewer-player-search-error');
    expect(field.className).toContain('oa-input');
    expect(field.className).toContain('min-h-11');
    expect(ref.current).toBe(field);
  });

  it('generates stable unique label and message ids when callers omit id', () => {
    render(
      <>
        <Field label="First email" description="Primary" />
        <Field label="Second email" error="Required" />
      </>,
    );
    const first = screen.getByLabelText('First email');
    const second = screen.getByLabelText('Second email');
    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
    expect(first).toHaveAttribute('aria-describedby', `${first.id}-description`);
    expect(second).toHaveAttribute('aria-describedby', `${second.id}-error`);
  });
});

describe('Dialog', () => {
  it('renders a modal dialog with labelled semantics and focus management', () => {
    const onClose = vi.fn();
    const ref = createRef<HTMLDivElement>();
    render(
      <Dialog ref={ref} titleId="share-dialog-title" onClose={onClose} className="max-w-sm">
        <h2 id="share-dialog-title">Share link</h2>
        <ActionButton onClick={onClose}>Close</ActionButton>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Share link' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.className).toContain('bg-broadcast-white');
    expect(dialog.className).toContain('ring-[3px]');
    expect(dialog.className).toContain('ring-ink');
    expect(ref.current).toBe(dialog);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('preserves an explicit consumer overlay layer', () => {
    render(
      <Dialog titleId="layer-title" onClose={() => undefined} overlayClassName="z-[100]" placement="center">
        <h2 id="layer-title">Layered dialog</h2>
      </Dialog>,
    );
    const overlay = screen.getByRole('dialog', { name: 'Layered dialog' }).parentElement;
    expect(overlay).toHaveClass('z-[100]');
    expect(overlay).toHaveClass('items-center');
    expect(overlay).not.toHaveClass('items-end');
  });

  it('can expose an explicit backdrop close target when a current consumer already has one', () => {
    const onClose = vi.fn();
    render(
      <Dialog titleId="find-squares-title" onClose={onClose} backdropLabel="Close Find my squares">
        <h2 id="find-squares-title">Find my squares</h2>
        <ActionButton>Find</ActionButton>
      </Dialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close Find my squares' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
