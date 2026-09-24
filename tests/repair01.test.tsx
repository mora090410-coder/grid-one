import React from 'react';
import { fireEvent,render,screen,within } from '@testing-library/react';
import { describe,it,expect,vi } from 'vitest';
import { parseScannedBoard } from '../functions/_lib/scanBoard';
import { resolvePhotoOrientation,photoOrientationResolved } from '../utils/photoOrientation';
import { currentSquareIndex } from '../src/features/viewer/scenarios/scenarioModel';
import { hasValidAxes } from '../utils/boardValidation';
import { readCreateDraft,writeCreateDraft } from '../src/features/organizer/create/createDraft';
import { INITIAL_GAME } from '../hooks/usePoolData';
import ViewerShell from '../src/features/viewer/shell/ViewerShell';

// jsdom has no layout/scroll implementation.
Element.prototype.scrollIntoView = vi.fn();
import NumberSetsEditor from '../src/features/organizer/workspace/NumberSetsEditor';
import type { LiveGameData } from '../types';
const digits=[0,1,2,3,4,5,6,7,8,9];
const sets={Q1:digits,Q2:[...digits.slice(2),0,1],Q3:[...digits].reverse(),Q4:[...digits.slice(3),0,1,2]};
const grid=Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>`Paper row ${r} column ${c}`));
const raw={isDynamic:false,leftAxis:digits,topAxis:digits,squaresGrid:grid,topTeamText:'DAL',leftTeamText:'WAS'};
const game={...INITIAL_GAME,topAbbr:'WAS',leftAbbr:'DAL',gameExternalId:'401772510'};

describe('repair01 deterministic photo contracts, NOT real OCR',()=>{
 it.each([
  {...raw,topAxis:[...digits,4]}, {...raw,topAxisByQuarter:{}},
  {...raw,isDynamic:true,topAxisByQuarter:[]}, {...raw,isDynamic:true,topAxisByQuarter:{Q5:digits}},
 ])('rejects ambiguous provider shape without a publishable normalization',value=>{expect(()=>parseScannedBoard(value)).toThrow(/Scan needs review/);});
 it.each([false,true])('requires explicit reversed orientation; transposes all sets and asymmetric ownership before draft save (%s)',isDynamic=>{
  const scanned=parseScannedBoard({...raw,isDynamic,...(isDynamic?{leftAxisByQuarter:sets,topAxisByQuarter:sets}:{})});
  expect(hasValidAxes(scanned)).toBe(false);
  const change=vi.fn();const view=render(<NumberSetsEditor board={scanned} game={game} onChange={change} allowPhotoTranspose />);
  fireEvent.click(screen.getByRole('button',{name:/flip the board/}));
  const resolved=change.mock.calls[0][0];expect(resolved).toEqual(resolvePhotoOrientation(scanned,game,true));
  expect(resolved.squares[21]).toEqual(['Paper row 1 column 2']);
  expect(scanned.squares[12]).toEqual(['Paper row 1 column 2']);
  expect(photoOrientationResolved(resolved,game)).toBe(true);
  expect(photoOrientationResolved(resolved,{...game,topAbbr:'KC'})).toBe(false);
  const storage=new Map<string,string>();writeCreateDraft({setItem:(k,v)=>{storage.set(k,v);}},{game,board:resolved},1000);
  const loaded=readCreateDraft({getItem:k=>storage.get(k)??null},1001).draft!.board;
  expect(loaded).toEqual(resolved);
  for(const [i,key] of (['Q1','Q2','Q3','Q4'] as const).entries()){
   const topScore=isDynamic?sets[key][1]:1, leftScore=isDynamic?sets[key][2]:2;
   const winner=currentSquareIndex({topScore,leftScore,period:i+1,state:'in'} as LiveGameData,loaded);
   expect(winner).toBe(21);expect(loaded.squares[winner]).toEqual(['Paper row 1 column 2']);
  }
  view.unmount();
 });
 it('current-square action exits Q1 inspection during Q2, and board identity resets inspection',()=>{
  const board={leftAxis:digits,topAxis:digits,isDynamic:true,leftAxisByQuarter:sets,topAxisByQuarter:sets,squares:grid.flat().map(n=>[n])};
  const live={period:2,state:'in',topScore:3,leftScore:4,clock:'12:00',freshness:'fresh',quarterScores:{Q1:{left:0,top:0},Q2:{left:4,top:3}}} as LiveGameData;
  const props={game,board,live,liveStatus:'LIVE',isSynced:true,highlights:{quarterWinners:{},currentLabel:''},winnerHistory:[],pendingMilestones:[],selectedPlayer:'Paper row 2 column 1',onClearPlayer:vi.fn(),onFindSquares:vi.fn(),highlightedCoords:null,onScenarioFocus:vi.fn(),shareCode:'RRRRR234',servicesEnabled:false};
  const view=render(<ViewerShell {...props}/>);
  const tabs=screen.getByRole('group',{name:'Quarter numbers'});
  fireEvent.click(within(tabs).getByRole('button',{name:'1st'}));
  expect(screen.getByText(/Showing 1st numbers/)).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'View on board top 3 side 4'}));
  expect(screen.getByText(/Showing 2nd numbers/)).toBeVisible();
  expect(props.onScenarioFocus).toHaveBeenCalledWith({top:3,left:4});
  fireEvent.click(within(tabs).getByRole('button',{name:'1st'}));
  view.rerender(<ViewerShell {...props} shareCode="SSSSS234"/>);
  expect(screen.getByText(/Showing 2nd numbers/)).toBeVisible();
 });
});
