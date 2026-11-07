import { expect, it } from 'vitest';
import { summarizeSellers } from '../src/features/organizer/sellers/sellerLinksModel';
import { salesCells } from '../src/features/viewer/sales/salesBoardModel';
import { SAMPLE_BOARD } from '../fixtures/sampleBoard.fixture';

it('counts blank family allocations as unsold without treating multiple names as placeholders', () => {
  expect(summarizeSellers(['Maple','Maple','Maple','Maple'], [[],['Maple'],['Buyer'],['Maple','Buyer']])).toEqual([{label:'Maple',total:4,unsold:2}]);
  expect(summarizeSellers(['Maple'], [[]])[0].unsold).toBe(1);
  expect(summarizeSellers(['Maple'], [['Maple','Buyer']])[0].unsold).toBe(0);
});
it('keeps explicit availability independent but identifies named-family claim conflicts', () => {
  const board = {...SAMPLE_BOARD, squares: Array.from({length:100},(_,i)=>i===0?['Buyer']:i===1?['Maple']:[]), allocationLabels:Array.from({length:100},(_,i)=>i<3?'Maple':null), availability:Array(100).fill('available')};
  const cells = salesCells(board);
  expect(cells[0]).toMatchObject({availability:'available',buyerRecorded:true});
  expect(cells[1]).toMatchObject({availability:'available',buyerRecorded:false});
  expect(cells[2]).toMatchObject({availability:'available',buyerRecorded:false});
  expect(cells[3]).toMatchObject({availability:'available',buyerRecorded:false});
});
