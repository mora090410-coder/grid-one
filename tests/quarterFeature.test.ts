import { describe, expect, it } from 'vitest';
import { parseScannedBoard, BOARD_SCAN_PROMPT } from '../functions/_lib/scanBoard';
import { hasValidAxes } from '../utils/boardValidation';
import { readCreateDraft, writeCreateDraft } from '../src/features/organizer/create/createDraft';
import { INITIAL_GAME } from '../hooks/usePoolData';
import { buildBoardGridModel } from '../src/features/viewer/board/boardGridModel';
import { calculateCurrentWinner } from '../utils/winnerLogic';
import { projectSalesBoard } from '../functions/_lib/pregameBoard';
import { projectQuarterAxes } from '../utils/quarterAxes';
import type { BoardData, LiveGameData, WinnerResolution } from '../types';

const digits = [0,1,2,3,4,5,6,7,8,9];
const sets = { Q1: digits, Q2: [...digits.slice(1),0], Q3: [...digits.slice(2),0,1], Q4: [...digits].reverse() };
const make = (): BoardData => ({ squares: Array.from({length:100}, (_, i) => [`Buyer ${i}`]), leftAxis: digits, topAxis: digits, isDynamic: true, topAxisByQuarter: structuredClone(sets), leftAxisByQuarter: structuredClone(sets) });

describe('quarter feature contracts — deterministic, not real-image OCR', () => {
  it('retains known duplicate sample digits and unread positions without inventing the other seven axes', () => {
    const sample = [9,2,6,0,7,4,5,8,0,9];
    const value = parseScannedBoard({ isDynamic: true, topTeamText: '49ERS', leftTeamText: 'CHIEFS', topAxisByQuarter: {Q1:sample,Q2:[3,null,'?']}, squaresGrid: Array.from({length:10}, () => Array(10).fill('TEST NAME — not sample transcription')) });
    expect(value.topAxisByQuarter?.Q1).toEqual(sample);
    expect(value.topAxisByQuarter?.Q2).toEqual([3,null,null,null,null,null,null,null,null,null]);
    expect(value.leftAxisByQuarter?.Q4).toEqual(Array(10).fill(null));
    expect(value.scanReview?.literalAxes).toContain('"?"');
    expect(value.scanReview?.topTeamText).toBe('49ERS');
    expect(value.scanReview?.leftTeamText).toBe('CHIEFS');
    expect(value.squares).toHaveLength(100);
    expect(hasValidAxes(value)).toBe(false);
    expect(BOARD_SCAN_PROMPT).toContain('Never enforce unique digits');
  });
  it('round-trips four distinct sets and literal review through the 24-hour create preview', () => {
    const value = make();
    value.scanReview = {topTeamText:'TOP',leftTeamText:'SIDE',literalAxes:'literal'};
    const storage = new Map<string,string>();
    expect(writeCreateDraft({setItem:(key,value) => {storage.set(key,value);}}, {game:INITIAL_GAME,board:value},1000)).toBe(true);
    const loaded = readCreateDraft({getItem:key => storage.get(key) ?? null},1001);
    expect(loaded.draft?.board).toEqual(value);
  });
  it('uses permanent positions for distinct live winners and Final including OT', () => {
    const value = make();
    const indices = [0,99,88,99];
    for (const [index, period] of [1,2,3,5].entries()) {
      const live = {topScore:0,leftScore:0,period,state:'in'} as LiveGameData;
      expect(calculateCurrentWinner(live,value)?.squareIndex).toBe(indices[index]);
    }
    expect(calculateCurrentWinner({topScore:0,leftScore:0,period:5,state:'post'} as LiveGameData,value)?.squareIndex).toBe(99);
  });
  it('does not paint Q1 history onto the wrong Q2 owner and permits Q1 inspection', () => {
    const value = make();
    const input = {board:value,game:INITIAL_GAME,live:{topScore:0,leftScore:0,period:2,state:'in'} as LiveGameData,highlights:{quarterWinners:{Q1:'0-0'},currentLabel:'NOW'},winnerHistory:[{milestone:'Q1',topDigit:0,sideDigit:0}] as WinnerResolution[],pendingMilestones:[],selectedPlayer:'',highlightedCoords:null,showOpenSquares:true};
    const current = buildBoardGridModel(input);
    expect(current.cells[9][9].states).toContain('current');
    expect(current.cells[9][9].states).not.toContain('resolved');
    const past = buildBoardGridModel({...input,selectedQuarter:'Q1'});
    expect(past.cells[0][0].states).toContain('resolved');
    expect(past.cells.flat().some(cell => cell.states.includes('current'))).toBe(false);
    expect(past.cells[0][0].names).toEqual(['Buyer 0']);
  });
  it('removes all draft numbers and private scan review from sales and published projections', () => {
    const value = {...make(),scanReview:{topTeamText:'TOP',leftTeamText:'SIDE',literalAxes:'private'}};
    const sales = projectSalesBoard(value);
    expect(sales.topAxis).toEqual(Array(10).fill(null));
    expect(sales).not.toHaveProperty('topAxisByQuarter');
    expect(sales).not.toHaveProperty('scanReview');
    const axes = projectQuarterAxes(value);
    expect(axes.topAxisByQuarter).toEqual(sets);
    expect(axes).not.toHaveProperty('scanReview');
  });
});
