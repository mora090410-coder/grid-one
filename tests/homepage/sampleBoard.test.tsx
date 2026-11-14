import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SampleBoard } from '../../src/features/homepage/sections/SampleBoard';

// The deep sample is retained as a standalone component, not repeated on the landing page.
const renderPage = () => render(<MemoryRouter><SampleBoard /></MemoryRouter>);

describe('Standalone sample board accessibility', () => {
  it('explores a real 100-square sample with keyboard-accessible details and truthful stages', () => {
    renderPage();
    const sample = screen.getByRole('region', { name: 'Interactive sample board' });
    expect(within(sample).getAllByRole('gridcell')).toHaveLength(100);
    expect(within(sample).getByText('Select a numbered square to see its name and position.')).toBeVisible();
    expect(within(sample).getByText('Numbers not drawn')).toBeVisible();
    fireEvent.click(within(sample).getByRole('button', { name: 'Share' }));
    expect(within(sample).getByText(/Public viewer link: viewing only/)).toBeVisible();
    expect(within(sample).getByRole('link', { name: 'Open sample viewer' })).toHaveAttribute('href', '/demo');
    fireEvent.click(within(sample).getByRole('button', { name: 'Game day' }));
    expect(within(sample).getByText(/Currently matching: Taylor M./)).toBeVisible();
    expect(within(sample).getByText(/No confirmed quarter results in this illustration/)).toBeVisible();
    const cell = within(sample).getByRole('gridcell', { name: /Square 1, Taylor M\./ });
    fireEvent.click(cell);
    expect(within(sample).getByRole('status')).toHaveTextContent('Square 1 · Taylor M.');
    fireEvent.keyDown(cell, { key: 'ArrowRight' });
    expect(within(sample).getByRole('gridcell', { name: /Square 2,/ })).toHaveFocus();
    expect(within(sample).getAllByRole('gridcell').filter(el => el.tabIndex === 0)).toHaveLength(1);
    fireEvent.click(within(sample).getByRole('button', { name: 'Set up' }));
    expect(within(sample).getByText('Numbers not drawn')).toBeVisible();
  });

  it('provides large previous/next controls for dense-grid touch inspection and names the current match', () => {
    renderPage();
    const sample = screen.getByRole('region', { name: 'Interactive sample board' });
    expect(within(sample).getByRole('button', { name: 'Previous square' })).toBeDisabled();
    fireEvent.click(within(sample).getByRole('button', { name: 'Next square' }));
    expect(within(sample).getByTestId('sample-inspection-announcement')).toHaveTextContent('Square 2');
    expect(within(sample).getByRole('status')).toHaveAttribute('aria-live', 'off');
    fireEvent.click(within(sample).getByRole('button', { name: 'Previous square' }));
    fireEvent.click(within(sample).getByRole('button', { name: 'Game day' }));
    expect(within(sample).getByRole('gridcell', { name: /Square 1, Taylor M.*currently matching/ })).toBeInTheDocument();
    expect(within(sample).getByRole('status')).toHaveTextContent('Currently matching');
  });

  it('keeps one polite atomic announcement region for controls without repeating grid or stage inspections', () => {
    renderPage();
    const sample = screen.getByRole('region', { name: 'Interactive sample board' });
    const announcement = within(sample).getByTestId('sample-inspection-announcement');
    const inspector = within(sample).getByRole('status');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
    expect(announcement).toHaveAttribute('aria-atomic', 'true');
    expect(announcement).toBeEmptyDOMElement();
    expect(inspector).toHaveAttribute('aria-live', 'off');
    fireEvent.click(within(sample).getByRole('button', { name: 'Next square' }));
    expect(announcement).toHaveTextContent('Square 2');
    expect(within(sample).getByTestId('sample-inspection-announcement')).toBe(announcement);
    fireEvent.click(within(sample).getByRole('button', { name: 'Next square' }));
    expect(announcement).toHaveTextContent('Square 3');
    fireEvent.click(within(sample).getByRole('button', { name: 'Previous square' }));
    expect(announcement).toHaveTextContent('Square 2');
    expect(within(sample).getByTestId('sample-inspection-announcement')).toBe(announcement);
    const cell = within(sample).getByRole('gridcell', { name: /Square 4,/ });
    fireEvent.click(cell);
    fireEvent.keyDown(cell, { key: 'ArrowRight' });
    fireEvent.click(within(sample).getByRole('button', { name: 'Game day' }));
    expect(announcement).toBeEmptyDOMElement();
    expect(within(sample).getByTestId('sample-inspection-announcement')).toBe(announcement);
    expect(inspector).toHaveAttribute('aria-live', 'off');
  });

  it('keeps selected coordinates and supporter positions across stages and keyboard boundaries', () => {
    renderPage();
    const sample = screen.getByRole('region', { name: 'Interactive sample board' });
    const cells = within(sample).getAllByRole('gridcell');
    const inspector = within(sample).getByRole('status');
    fireEvent.keyDown(cells[0], { key: 'End' });
    expect(cells[9]).toHaveFocus();
    expect(inspector).toHaveAttribute('aria-live', 'off');
    fireEvent.keyDown(cells[9], { key: 'ArrowRight' });
    expect(cells[9]).toHaveFocus();
    fireEvent.keyDown(cells[9], { key: 'ArrowDown' });
    expect(cells[19]).toHaveFocus();
    expect(inspector).toHaveTextContent('Row 2 · Column 10');
    expect(within(sample).getAllByRole('rowheader')[1]).toHaveAttribute('data-inspected', 'true');
    expect(within(sample).getAllByRole('columnheader')[10]).toHaveAttribute('data-inspected', 'true');
    for (const stage of ['Game day', 'Share', 'Game day', 'Set up']) {
      fireEvent.click(within(sample).getByRole('button', { name: stage }));
      expect(within(sample).getByRole('status')).toBe(inspector);
      expect(cells[19]).toHaveAttribute('aria-selected', 'true');
      expect(cells[0]).toHaveAccessibleName(/Square 1, Taylor M\./);
    }
    fireEvent.keyDown(cells[19], { key: 'Home' });
    expect(cells[10]).toHaveFocus();
    fireEvent.keyDown(cells[10], { key: 'ArrowUp' });
    fireEvent.keyDown(cells[0], { key: 'ArrowLeft' });
    expect(cells[0]).toHaveFocus();
    fireEvent.click(cells[99]);
    fireEvent.keyDown(cells[99], { key: 'ArrowDown' });
    expect(cells[99]).toHaveFocus();
    expect(within(sample).getAllByRole('gridcell').filter(cell => cell.tabIndex === 0)).toHaveLength(1);
  });

});
