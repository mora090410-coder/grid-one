import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {Base} from '../../src/design/Base';
import BoardEditor from '../../src/features/organizer/workspace/BoardEditor';

describe('liquid organizer styling slice 7',()=>{
 it('scopes both existing organizer branches without replacing their flows',()=>{
  const source=readFileSync(`${process.cwd()}/src/features/organizer/workspace/OrganizerWorkspace.tsx`,'utf8');
  for (const page of ['Dashboard','CreateContest']) expect(readFileSync(`pages/${page}.tsx`,'utf8')).toContain('theme="liquid"');
  expect(source.match(/<Base kind="dark" theme="liquid" className="g1-page g1-organizer-page">/g)).toHaveLength(1);
 });
 it('uses allocation tints while preserving square activation',()=>{
  const onSelectSquare=vi.fn();
  render(<Base kind="dark" theme="liquid" className="g1-page"><BoardEditor game={{topAbbr:'WAS',topName:'Washington',leftAbbr:'DAL',leftName:'Dallas'}} board={{squares:Array.from({length:100},()=>[]),topAxis:Array(10).fill(null),leftAxis:Array(10).fill(null),allocationLabels:Array(100).fill('Jamie')}} entryMeta={{}} drawPreview={null} highlightOpen={false} isPublished={false} canAssignOpenSquares={false} selectMode={false} selection={new Set()} onSelectionChange={vi.fn()} onToggleSelectMode={vi.fn()} onSelectSquare={onSelectSquare}/></Base>);
  const cell=screen.getByRole('button',{name:'Square 2, unassigned, allocated to Jamie, blank'});
  expect(cell).toHaveAttribute('data-g1-seller','1');
  expect(cell.style.getPropertyValue('--t')).toContain('--g1-seller-1');
  fireEvent.click(cell);expect(onSelectSquare).toHaveBeenCalledWith(1);
 });
});
