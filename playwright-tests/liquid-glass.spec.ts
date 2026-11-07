import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {installOrganizerBoard,boardId} from './helpers/organizerMocks';

const installViewer = async(page:import('@playwright/test').Page)=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true}));
 const score={leftScore:7,topScore:10,quarterScores:{Q1:{left:1,top:3},Q2:{left:6,top:7},Q3:{left:0,top:0},Q4:{left:0,top:0},OT:{left:0,top:0}},clock:'4:12',period:2,state:'in',isOvertime:false,freshness:'fresh',sourceName:'ESPN',retrievedAt:new Date().toISOString()};
 const board={leftAxis:[0,1,2,3,4,5,6,7,8,9],topAxis:[0,1,2,3,4,5,6,7,8,9],squares:Array.from({length:100},(_,i)=>[i===70?'Maria L.':`Sample buyer ${i+1}`]),allocationLabels:Array(100).fill('Jamie Chen'),isDynamic:false,allowOpenSquares:false};
 await page.route('**/api/pools/LIQUID01',r=>r.fulfill({json:{share_code:'LIQUID01',title:'LOCAL TEST · Liquid Glass',revision:1,published_at:'2026-09-12T20:00:00Z',gameExternalId:'local-test-game',leftAbbr:'DAL',leftName:'Dallas Cowboys',topAbbr:'WAS',topName:'Washington Commanders',board,score,winner_history:[],pending_milestones:[],payoutDescriptions:{},is_activated:true,locked:false}}));
 await page.route('**/api/pools/LIQUID01/score',r=>r.fulfill({json:{score,winnerHistory:[],pendingMilestones:[]}}));
};
for(const width of [320,390,1280]){
 test(`Liquid viewer accessible materials and one winning glow at ${width}`,async({page,browserName},info)=>{
  await page.setViewportSize({width,height:900});await installViewer(page);await page.goto('/b/LIQUID01');
  await page.getByRole('button',{name:'Find my squares',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Maria L.',exact:true}).click();
  const hero=page.locator('[data-g1-personal-win="true"]');await expect(hero).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  const blurCount=await page.locator('[data-g1-theme="liquid"] *').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).backdropFilter!=='none'&&getComputedStyle(n).backdropFilter!=='').length);
  expect(blurCount).toBeLessThanOrEqual(6);
  expect(await hero.evaluate(n=>getComputedStyle(n).boxShadow.includes('60px'))).toBe(width<700);
  expect(await page.locator('.g1-cell--live').evaluate(n=>getComputedStyle(n).boxShadow.includes('34px'))).toBe(width>=700);
  const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
  await info.attach('axe.json',{body:JSON.stringify(violations,null,2),contentType:'application/json'});
  expect(violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
  await page.screenshot({path:info.outputPath(`liquid-personal-${width}.png`),fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  if(browserName==='chromium') {
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'},{name:'prefers-reduced-motion',value:'reduce'}]});
  } else {
   // Playwright exposes no native reduced-transparency emulation for WebKit.
   // Activate the real loaded media rules to verify its fallback cascade;
   // Chromium above separately verifies native media emulation.
   const activated=await page.evaluate(()=>{
    let count=0;
    const visit=(rules:CSSRuleList)=>{for(const rule of Array.from(rules)) {
     if(rule instanceof CSSMediaRule&&rule.conditionText.includes('prefers-reduced-transparency')) {rule.media.appendMedium('all');count++;}
     else if('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
    }};
    for(const sheet of Array.from(document.styleSheets)) {try {visit(sheet.cssRules);} catch { /* Cross-origin sheets are not this app's material rules. */ }}
    return count;
   });
   expect(activated).toBeGreaterThan(0);
  }
  await expect(hero).toHaveCSS('background-color','rgb(20, 30, 49)');
  await expect(hero).toHaveCSS('background-image','none');
  await expect(hero).toHaveCSS('backdrop-filter','none');
  await page.keyboard.press('Tab');
  await page.getByRole('button',{name:'Choose another name'}).focus();
  await expect(page.getByRole('button',{name:'Choose another name'})).toHaveCSS('outline-width','2px');
  await expect(page.getByRole('button',{name:'Choose another name'})).toHaveCSS('outline-offset','2px');
 });
}
for(const width of [390,1280]) test(`Liquid organizer preserves editing and containment at ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await installOrganizerBoard(page);await page.goto(`/boards/${boardId}`);
 await expect(page.getByRole('main',{name:'Parkside browser board workspace'})).toBeVisible();
 await expect(page.locator('[data-base][data-g1-theme="liquid"]')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 await page.getByRole('button',{name:'Square 2, unassigned',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Square 2',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await page.screenshot({path:info.outputPath(`liquid-organizer-${width}.png`),fullPage:true});
});
