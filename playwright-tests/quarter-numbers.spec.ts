import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, ownerId, scheduledGame, installOrganizerSession, installOrganizerSupport } from './helpers/organizerMocks';
import type { BoardData } from '../types';

for (const exportMode of ['download','native-contract'] as const) for (const width of [390,1440]) {
  test(`four-set draw, save/reload, preview and viewer inspection ${width}px ${exportMode}`, async ({page},testInfo) => {
    test.setTimeout(90000);
    await page.setViewportSize({width,height:900});
    // All account and API traffic is deterministic route interception, not a live account.
    await page.route('https://**/*', route => route.fulfill({status:200,json:[]}));
    await installOrganizerSession(page); await installOrganizerSupport(page);
    let board: BoardData = {leftAxis:Array(10).fill(null),topAxis:Array(10).fill(null),isDynamic:false,squares:Array.from({length:100},(_,i) => [`Buyer ${i + 1}`]),allocationLabels:Array(100).fill('Family'),allowOpenSquares:false};
    const names = structuredClone(board.squares);
    let revision = 1; let published = false;
    const row = () => ({id:boardId,owner_id:ownerId,share_code:'QQQQQ234',title:'Quarter browser verification',revision,meta:'',gameExternalId:scheduledGame.id,kickoffAt:scheduledGame.kickoffAt,leftAbbr:'DAL',leftName:'Dallas Cowboys',topAbbr:'WAS',topName:'Washington Commanders',board,is_activated:published,locked:published,is_shared:false,published_at:published ? '2026-09-11T00:00:00Z' : null,winner_history:[],pending_milestones:[],notification_delivery_issues:[],payoutDescriptions:{}});
    const score = {leftScore:7,topScore:3,quarterScores:{Q1:{left:0,top:0},Q2:{left:0,top:0},Q3:{left:0,top:0},Q4:{left:7,top:3},OT:{left:0,top:0}},clock:'3:00',period:4,state:'in',detail:'Q4',isOvertime:false,isManual:true,sourceName:'Organizer',retrievedAt:new Date().toISOString(),freshness:'fresh'};
    await page.route('**/api/pools/*/score', route => route.fulfill({json:{score:published ? score : null,winnerHistory:[],pendingMilestones:[]}}));
    await page.route(`**/api/pools/${boardId}`, async route => {
      if (route.request().method() === 'PUT') {
        board = route.request().postDataJSON().board; revision++;
        await route.fulfill({json:{ok:true,revision}});
      } else await route.fulfill({json:row()});
    });
    await page.route('**/api/pools/QQQQQ234', route => route.fulfill({json:{...row(),owner_id:undefined,locked:false,score}}));
    await page.route(`**/api/pools/${boardId}/publish`, route => {
      expect(board.isDynamic).toBe(true);
      for (const sets of [board.topAxisByQuarter,board.leftAxisByQuarter]) for (const key of ['Q1','Q2','Q3','Q4'] as const) expect(new Set(sets?.[key]).size).toBe(10);
      published = true;
      return route.fulfill({json:{published:true,shareCode:'QQQQQ234',viewerUrl:'/b/QQQQQ234',revision:++revision,tier:'free',used:1,allowance:1}});
    });
    await page.goto(`/boards/${boardId}`);
    await page.getByRole('radio',{name:'New numbers each quarter',exact:true}).check();
    await page.getByRole('button',{name:'Prepare to publish',exact:true}).first().click();
    // Each quarter tab shows that quarter's draft draw before it is kept.
    for (const label of ['1st','2nd','3rd','Final']) {
      await page.getByRole('group',{name:'Quarter numbers',exact:true}).getByRole('button',{name:label,exact:true}).click();
      await expect(page.getByText(`Showing ${label} numbers`,{exact:false}).first()).toBeVisible();
    }
    await testInfo.attach('quarter-organizer-draw', {body:await page.screenshot({path:testInfo.outputPath('quarter-organizer-draw.png'),fullPage:true}),contentType:'image/png'});
    await page.getByRole('button',{name:'Use numbers and continue',exact:true}).click();
    await expect.poll(() => board.isDynamic).toBe(true);
    await expect.poll(() => (['Q1','Q2','Q3','Q4'] as const).every(key => new Set(board.topAxisByQuarter?.[key]).size === 10 && new Set(board.leftAxisByQuarter?.[key]).size === 10)).toBe(true);
    // The four sets are independent draws, not one set copied four times.
    expect(new Set((['Q1','Q2','Q3','Q4'] as const).map(key => JSON.stringify(board.topAxisByQuarter?.[key]))).size).toBeGreaterThan(1);
    expect(board.squares).toEqual(names);
    await page.keyboard.press('Escape');
    const beforeReload = structuredClone(board);
    await page.evaluate(() => {
      const original = CanvasRenderingContext2D.prototype.fillText;
      (window as any).quarterCanvasText = [];
      CanvasRenderingContext2D.prototype.fillText = function(text: string, ...args: any[]) {
        (window as any).quarterCanvasText.push(text);
        return original.call(this,text,args[0],args[1],args[2]);
      };
    });
    // Exercise both production branches explicitly. The native receiver is a contract
    // double, NOT evidence of sending an image through a physical OS share sheet.
    await page.evaluate(mode => {
      Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>mode==='native-contract'});
      if(mode==='native-contract') Object.defineProperty(navigator,'share',{configurable:true,value:async(data:ShareData)=>{
        const file=data.files![0]; const bytes=Array.from(new Uint8Array(await file.arrayBuffer()).slice(0,8));
        (window as any).nativeExport={name:file.name,size:file.size,type:file.type,bytes};
      }});
    },exportMode);
    const downloading = exportMode==='download' ? page.waitForEvent('download') : null;
    await page.getByRole('button',{name:'Share board image',exact:true}).click();
    if(downloading) {
      const download=await downloading;
      await download.saveAs(testInfo.outputPath('final-quarter-board.png'));
      expect(await download.failure()).toBeNull();
    } else {
      await expect.poll(()=>page.evaluate(()=>(window as any).nativeExport?.type)).toBe('image/png');
      const file=await page.evaluate(()=>(window as any).nativeExport);
      expect(file.size).toBeGreaterThan(0);expect(file.bytes).toEqual([137,80,78,71,13,10,26,10]);
      await testInfo.attach('native-contract-received-file',{body:JSON.stringify(file),contentType:'application/json'});
    }
    expect(await page.evaluate(() => (window as any).quarterCanvasText)).toContain('Final numbers · Includes overtime');
    await page.reload();
    await expect(page.getByRole('radio',{name:'New numbers each quarter',exact:true})).toBeChecked();
    expect(board).toEqual(beforeReload);
    await page.getByRole('button',{name:'Preview and publish',exact:true}).first().click();
    const preview = page.getByRole('dialog',{name:'Private preview — sharing is off',exact:true});
    await expect(preview.getByRole('group',{name:'Quarter numbers',exact:true})).toBeVisible();
    await preview.getByRole('button',{name:'Review and publish',exact:true}).click();
    const confirm = page.getByRole('dialog',{name:'Publish viewer link',exact:true});
    await expect(confirm).toContainText('Final · Top axis');
    await confirm.getByRole('button',{name:'Publish viewer link',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Published',exact:true})).toBeVisible();
    await page.goto('/b/QQQQQ234');
    await expect(page.getByText('Showing Final numbers',{exact:false})).toBeVisible();
    await page.getByRole('group',{name:'Quarter numbers',exact:true}).getByRole('button',{name:'1st',exact:true}).click();
    await expect(page.getByText('Showing 1st numbers',{exact:false})).toBeVisible();
    await expect(page.getByRole('columnheader',{name:`Washington Commanders top digit ${board.topAxisByQuarter!.Q1![0]}`,exact:true})).toBeVisible();
    score.period=2;
    await page.reload();
    await expect(page.getByText('Showing 2nd numbers',{exact:false})).toBeVisible();
    await page.getByText('All possible next scores',{exact:true}).click();
    await page.getByRole('group',{name:'Quarter numbers',exact:true}).getByRole('button',{name:'1st',exact:true}).click();
    await page.getByRole('button',{name:/DAL Safety \+2/}).click();
    // Tapping a scenario returns to the current quarter's numbers.
    await expect(page.getByText('Showing 2nd numbers',{exact:false})).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const axe = await new AxeBuilder({page}).analyze();
    expect(axe.violations.filter(item => item.impact === 'critical' || item.impact === 'serious')).toEqual([]);
    await testInfo.attach('quarter-viewer', {body:await page.screenshot({path:testInfo.outputPath('quarter-viewer.png'),fullPage:true}),contentType:'image/png'});
  });
}
