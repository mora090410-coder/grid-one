import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, ownerId, scheduledGame, installOrganizerSession, installOrganizerSupport } from './helpers/organizerMocks';

// Stateful API-boundary fixture, not a production or database test. The paired
// sellerLinks.integration suite exercises the real SQL predicates and races.
for (const width of [390, 1440]) {
  test(`family → anonymous buyer → public and organizer persistence at ${width}px`, async ({ page, browser }, testInfo) => {
    page.setDefaultTimeout(5_000);
    const token = 'a'.repeat(64);
    const code = '0123456789abcdef';
    const labels = Array.from({ length: 100 }, (_, i) => [12,13,14].includes(i) ? 'Maple' : [21,22].includes(i) ? 'River' : null);
    const row = {
      id: boardId, owner_id: ownerId, share_code: 'ABCDEFGH', title: 'Workflow repair test', revision: 1,
      meta: '', gameExternalId: scheduledGame.id, kickoffAt: scheduledGame.kickoffAt,
      leftAbbr: 'DAL', leftName: 'Dallas Cowboys', topAbbr: 'WAS', topName: 'Washington Commanders',
      board: { squares: labels.map((label,i) => i===13 ? ['Recorded Buyer'] : label==='River' ? [label] : [] as string[]), allocationLabels: labels, availability: labels.map((_,i)=>i===13?'available':'unspecified') as Array<'available'|'unspecified'|'unavailable'>, leftAxis:Array(10).fill(null), topAxis:Array(10).fill(null), isDynamic:false, allowOpenSquares:false },
      is_activated:true, locked:false, is_shared:true, shared_at:'2026-11-07T12:00:00Z', published_at:null,
      updated_at:'2026-11-07T12:00:00Z', winner_history:[], pending_milestones:[], notification_delivery_issues:[], payoutDescriptions:{},
    };
    const install = async (target: Page, owner = false) => {
      target.setDefaultTimeout(5_000);
      await target.setViewportSize({width,height:900});
      if (owner) { await installOrganizerSession(target); await installOrganizerSupport(target); }
      await target.route('**/api/pools/*/guest-state', route=>route.fulfill({status:404,json:{code:'SHARING_UNAVAILABLE'}}));
      await target.route('**/api/pools/*/score', route=>route.fulfill({json:{score:null,winnerHistory:[],pendingMilestones:[]}}));
      await target.route('**/api/pools/*', route=>route.fulfill({json:{...row,owner_id:owner?ownerId:undefined}}));
      await target.route('**/api/family', async route=>{
        expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
        const body=route.request().postDataJSON();
        if(body.action==='edit'){
          expect(body.revision).toBe(row.revision);
          for(const change of body.changes){
            expect([12,13,14]).toContain(change.index);
            row.board.squares[change.index]=change.name?[change.name]:[];
            row.board.availability[change.index]=change.availability;
          }
          row.revision++;
        }
        await route.fulfill({json:{title:row.title,revision:row.revision,label:'Maple',cells:[12,13,14].map(index=>({index,name:row.board.squares[index][0]??'',availability:row.board.availability[index]}))}});
      });
      await target.route(`**/api/sellers/${code}`, async route=>{
        if(route.request().method()==='POST'){
          const body=route.request().postDataJSON();
          expect(body).toEqual({cells:[12],name:'New Buyer'});
          row.board.squares[12]=[body.name]; row.board.availability[12]='unavailable'; row.revision++;
          await route.fulfill({json:{cells:[12],name:body.name,label:'Maple',shareCode:row.share_code}}); return;
        }
        await route.fulfill({json:{title:row.title,label:'Maple',shareCode:row.share_code,open:true,sideTeamName:row.leftName,topTeamName:row.topName,cells:[12,13,14].map(index=>({index,available:row.board.availability[index]==='available' && row.board.squares[index].length===0}))}});
      });
    };
    await install(page); await page.goto(`/family#${token}`);
    await expect(page.getByRole('heading',{name:'Your 3 squares'})).toBeVisible();
    await expect(page.getByLabel('Name on square 22',{exact:true})).toHaveCount(0);
    // Availability-only on a blank square, then two further saves after success.
    await page.getByRole('combobox',{name:'Availability for square 13',exact:true}).selectOption('available');
    await page.getByRole('button',{name:'Save changes',exact:true}).click();
    await expect(page.getByText('Changes saved.',{exact:true})).toBeVisible();
    await page.getByLabel('Name on square 13',{exact:true}).fill('Temporary Buyer');
    await page.getByRole('button',{name:'Save changes',exact:true}).click();
    await expect(page.getByText('Changes saved.',{exact:true})).toBeVisible();
    await page.getByLabel('Name on square 13',{exact:true}).fill('');
    await page.getByRole('button',{name:'Save changes',exact:true}).click();
    await expect(page.getByText('Changes saved.',{exact:true})).toBeVisible();
    await expect(page.getByText('A buyer name is recorded. Your buyer link cannot replace it. Clear the name only if this square is yours to sell again.',{exact:true})).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const axe=await new AxeBuilder({page}).analyze();
    expect(axe.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
    await testInfo.attach(`family-repair-${width}`,{body:await page.screenshot({path:testInfo.outputPath(`family-repair-${width}.png`),fullPage:true}),contentType:'image/png'});
    const buyerContext=await browser.newContext({viewport:{width,height:900}});
    const organizerContext=await browser.newContext({viewport:{width,height:900}});
    try {
      const buyer=await buyerContext.newPage(); await install(buyer);
      await buyer.goto(`/s/${code}`);
      await expect(buyer.getByRole('button',{name:'Square 13, open',exact:true})).toBeEnabled();
      await expect(buyer.getByRole('button',{name:'Square 14, taken',exact:true,includeHidden:true})).toBeDisabled();
      await expect(buyer.getByRole('button',{name:'Square 15, taken',exact:true,includeHidden:true})).toBeDisabled();
      await expect(buyer.getByRole('button',{name:/Square 22,/})).toHaveCount(0);
      await buyer.getByRole('button',{name:'Square 13, open',exact:true}).click();
      await buyer.getByLabel('Your name, as it shows on the board').fill('New Buyer');
      await buyer.getByRole('button',{name:'Claim my square',exact:true}).click();
      await expect(buyer.getByRole('heading',{name:'You’re on the board'})).toBeVisible();
      await buyer.reload();
      await expect(buyer.getByRole('button',{name:'Square 13, taken',exact:true,includeHidden:true})).toBeDisabled();
      await page.reload();
      await expect(page.getByLabel('Name on square 13',{exact:true})).toHaveValue('New Buyer');
      await expect(page.getByRole('combobox',{name:'Availability for square 13',exact:true})).toHaveValue('unavailable');
      await buyer.goto('/b/ABCDEFGH');
      await expect(buyer.getByRole('gridcell',{name:'Square 13, New Buyer, Maple',exact:true})).toBeVisible();
      await buyer.getByRole('button',{name:'Show available squares',exact:true}).click();
      const details=buyer.getByRole('region',{name:'Square details'});
      await expect(details.getByText('Square 13',{exact:true})).toHaveCount(0);
      await expect(details.getByText('A buyer name is recorded. Contact the family; its buyer link cannot replace this name.',{exact:true})).toBeVisible();
      await testInfo.attach(`public-repair-${width}`,{body:await buyer.screenshot({path:testInfo.outputPath(`public-repair-${width}.png`),fullPage:true}),contentType:'image/png'});
      const organizer=await organizerContext.newPage(); await install(organizer,true);
      await organizer.goto(`/boards/${boardId}`);
      await expect(organizer.getByRole('button',{name:/^Square 13, assigned to New Buyer/})).toBeVisible();
      await expect(organizer.getByRole('button',{name:/^Square 22, assigned to River/})).toBeVisible();
    } finally { await Promise.allSettled([buyerContext.close(), organizerContext.close()]); }
  });
}
