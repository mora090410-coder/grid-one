import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import YourSquaresSummary from '../src/features/viewer/personal/YourSquaresSummary';
import ScoreInstrument from '../src/features/viewer/score/ScoreInstrument';
import NumberSetsEditor from '../src/features/organizer/workspace/NumberSetsEditor';
import { INITIAL_GAME } from '../hooks/usePoolData';
import type { BoardData, LiveGameData } from '../types';
const digits = [0,1,2,3,4,5,6,7,8,9];
const sets = {Q1:digits,Q2:[...digits.slice(1),0],Q3:[...digits.slice(2),0,1],Q4:[...digits].reverse()};
const board = (): BoardData => ({squares:Array.from({length:100},(_,i) => i === 0 ? ['Anthony'] : []),leftAxis:digits,topAxis:digits,isDynamic:true,leftAxisByQuarter:structuredClone(sets),topAxisByQuarter:structuredClone(sets)});
const live = {period:2,state:'in',topScore:1,leftScore:1,clock:'12:00',isManual:true,freshness:'fresh'} as LiveGameData;

describe('quarter viewer and literal review', () => {
  it('personal coordinates and focus use live-quarter axes instead of fixed compatibility axes', () => {
    const focus = vi.fn();
    render(<YourSquaresSummary board={board()} game={{...INITIAL_GAME,topAbbr:'TOP',leftAbbr:'SIDE'}} live={live} selectedPlayer="Anthony" onViewSquare={focus} />);
    expect(screen.getByText('TOP column 1 × SIDE row 1')).toBeInTheDocument();
    expect(screen.getByText('Winning right now.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'View on board top 1 side 1'}));
    expect(focus).toHaveBeenCalledWith({top:1,left:1});
  });
  it('invalid axes are explicitly unavailable, not falsely called an OPEN score result', () => {
    const value = board(); value.topAxisByQuarter!.Q2 = Array(10).fill(1);
    render(<ScoreInstrument board={value} game={INITIAL_GAME} live={live} liveStatus="LIVE" isSynced />);
    expect(screen.getByText('Numbers need review')).toBeInTheDocument();
    expect(screen.queryByText('Open square')).not.toBeInTheDocument();
  });
  it('displays duplicate/missing digits literally and never changes a mode without explicit confirmation', () => {
    const value = board(); value.topAxisByQuarter!.Q1 = [9,2,6,0,7,4,5,8,0,9];
    // Digit-by-digit review is shown for boards read from a paper photo.
    value.scanReview = { topTeamText: 'TOP', leftTeamText: 'SIDE', literalAxes: 'literal', orientation: { topAbbr: INITIAL_GAME.topAbbr, leftAbbr: INITIAL_GAME.leftAbbr, operation: 'unchanged' } };
    const change = vi.fn();
    render(<NumberSetsEditor board={value} game={INITIAL_GAME} onChange={change} />);
    expect(screen.getByText(/Used twice: 0, 9\. Missing: 1, 3\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio',{name:'One set for the whole game'}));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Switch'}));
    expect(change).toHaveBeenCalledWith({...value,isDynamic:false});
    expect(change.mock.calls[0][0].squares).toBe(value.squares);
    expect(change.mock.calls[0][0].topAxisByQuarter.Q1).toEqual([9,2,6,0,7,4,5,8,0,9]);
  });
});
