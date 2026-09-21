import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installOrganizerBoard, boardId, ownerId, scheduledGame } from './helpers/organizerMocks';

const inviteId = '33333333-3333-4333-8333-333333333333';
const guestPath = `/p/${boardId}?invite=browser-test-invite`;
const payment = { label: 'Arrange payment with Anthony', detail: 'Contact Anthony using the details you already have.', url: 'https://example.com/anthony' };
const code = 'amber-river-maple-star';
const makeBoard = () => ({ leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), squares: Array.from({ length:100 }, (_, i) => i < 10 ? ['Anthony'] : []), allocationLabels: Array.from({length:100}, (_, i) => i < 10 ? 'Anthony' : null), availability: Array.from({length:100}, (_, i): string => i < 10 ? 'available' : 'unspecified'), isDynamic: false, allowOpenSquares: true });

async function fixture(page: Page, emptyInvites = false) {
  let created = !emptyInvites;
  const board = makeBoard();
  let held: number[] = []; let heldUntil = ''; let receipt: any = null; let revision = 1; let disabled = false;
  const requests: any[] = [];
  const invite = () => ({ id:inviteId,label:'Anthony',cells:Array.from({length:10},(_,i)=>i),maxSquares:1,version:1,expiresAt:null,disabledAt:disabled?'2026-09-20T00:00:00Z':null,payment,url:guestPath,counts:{available:10-held.length-(receipt?.cells.length||0),held:held.length,claimed:receipt?.cells.length||0} });
  const snapshot = () => ({ boardId,title:'Parkside guest board',shareCode:'SHARE123',revision,serverTime:new Date().toISOString(),stage:'selling',squares:board.squares,allocationLabels:board.allocationLabels,availability:board.availability,holds:held.map(index=>({index,expiresAt:heldUntil,mine:true})),heldCells:held,claimedCells:receipt?.cells||[],invite:invite(),...(receipt?{mine:{...receipt,claimCode:undefined}}:{}) });
  const ownerList = () => ({revision,invites:created?[invite()]:[],claims:receipt?[{...receipt,claimCode:undefined,payment:null}]:[],holds:held.map(index=>({index,expiresAt:heldUntil,inviteId}))});
  const installGuest = async (target: Page) => target.route(`**/api/pools/${boardId}/guest`, async route => {
    const body = route.request().postDataJSON(); requests.push(body);
    if (disabled && ['read','hold','confirm'].includes(body.action)) return route.fulfill({status:403,json:{code:'INVITE_INACTIVE',error:'This invite link is no longer active.'}});
    if (body.action==='hold') { held=body.cells; heldUntil=new Date(Date.now()+90_000).toISOString(); revision++; }
    if (body.action==='confirm') {
      receipt={groupId:'44444444-4444-4444-8444-444444444444',inviteId,displayName:body.name,cells:[...held],claimedAt:new Date().toISOString(),canManage:true,payment,claimCode:code};
      for(const index of held){board.squares[index]=[body.name];board.availability[index]='unavailable';} held=[]; revision++;
    }
    if (body.action==='swap') {
      for(const index of receipt.cells){board.squares[index]=[];board.availability[index]='available';}
      receipt.cells=body.cells;
      for(const index of receipt.cells){board.squares[index]=[receipt.displayName];board.availability[index]='unavailable';} revision++;
    }
    if (body.action==='release') {for(const index of receipt.cells){board.squares[index]=[];board.availability[index]='available';}receipt.cells=[];revision++;}
    await route.fulfill({json:['read','hold'].includes(body.action)?snapshot():receipt});
  });
  await installGuest(page);
  await page.route(`**/api/pools/${boardId}/invites`, async route => {
    if(route.request().method()==='POST') { const body=route.request().postDataJSON();requests.push(body); if(body.action==='create') created=true; if(body.action==='disable'){disabled=true;held=[];} revision++; }
    await route.fulfill({json:ownerList()});
  });
  await page.route(`**/api/pools/${boardId}/guest-state`, route => route.fulfill({json:snapshot()}));
  return {board,requests,snapshot,installGuest,disable:()=>{disabled=true;held=[];},ownerList};
}

test('guest claims without an account, sees external instructions, then swaps without releasing first', async ({page}, info) => {
  const f=await fixture(page);
  await page.goto(guestPath);
  await expect(page.getByRole('heading',{name:/Choose from Anthony/})).toBeVisible();
  await expect(page.getByText(payment.detail)).toHaveCount(0);
  await page.getByRole('gridcell',{name:/^Square 1, available/}).click();
  await page.getByLabel('Name on your squares').fill('Maria');
  await page.getByRole('button',{name:'Claim 1 square',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your squares are claimed'})).toBeVisible();
  await expect(page.getByText(code,{exact:true})).toBeVisible();
  await expect(page.getByText(payment.detail)).toBeVisible();
  await expect(page.getByRole('link',{name:payment.label})).toHaveAttribute('href',payment.url);
  await page.screenshot({path:info.outputPath('guest-receipt.png'),fullPage:true});
  await page.getByRole('button',{name:'Change squares'}).click();
  await page.getByRole('gridcell',{name:/^Square 2, available/}).click();
  await page.getByRole('button',{name:'Save square change'}).click();
  await expect(page.getByText('Maria · Square 2',{exact:true})).toBeVisible();
  expect(f.requests.filter(request=>request.action==='hold')).toHaveLength(1);
  expect(f.requests.filter(request=>request.action==='release')).toHaveLength(0);
  expect(f.requests.some(request=>'paid_status' in request)).toBe(false);
  await page.reload();
  await expect(page.getByText('Maria · Square 2',{exact:true})).toBeVisible();
  await expect(page.getByText(code,{exact:true})).toBeVisible();
});

test('phone selection stays within the page and has accessible grid and claim controls',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await fixture(page); await page.goto(guestPath);
  await expect(page.getByRole('grid')).toBeVisible();
  const first=page.getByRole('gridcell',{name:/^Square 1, available/}); await first.focus();
  await page.keyboard.press('ArrowRight'); await expect(page.getByRole('gridcell',{name:/^Square 2, available/})).toBeFocused();
  await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Continue with Square 2',exact:true}).click();
  await expect(page.getByLabel('Name on your squares')).toBeFocused();
  await page.getByLabel('Name on your squares').fill('Lee');
  await expect(page.getByRole('button',{name:'Claim 1 square',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const analysis=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(analysis.violations.filter(v=>['critical','serious'].includes(v.impact||''))).toEqual([]);
  await page.screenshot({path:info.outputPath('guest-phone.png'),fullPage:true});
});

test('disabled link mid-selection is explained and preserves the entered name',async({page})=>{
  const f=await fixture(page);await page.goto(guestPath);
  await page.getByRole('gridcell',{name:/^Square 1, available/}).click();
  await page.getByLabel('Name on your squares').fill('Sam');f.disable();
  await page.getByRole('button',{name:'Claim 1 square',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('no longer active');
  await expect(page.getByRole('heading',{name:'Your squares are claimed'})).toHaveCount(0);
});

test('organizer creates a seller link and sees a fresh anonymous guest claim land',async({page,browser},info)=>{
  await page.clock.install();
  await installOrganizerBoard(page);const f=await fixture(page,true);
  await page.route(`**/api/pools/${boardId}`,route=>route.fulfill({json:{id:boardId,share_code:'SHARE123',owner_id:ownerId,title:'Parkside guest board',revision:f.snapshot().revision,gameExternalId:scheduledGame.id,kickoffAt:scheduledGame.kickoffAt,leftName:'Dallas Cowboys',leftAbbr:'DAL',topName:'Washington Commanders',topAbbr:'WAS',board:f.board,published_at:null,shared_at:'2026-09-20T00:00:00Z',locked:false,is_activated:true}}));
  await page.goto(`/boards/${boardId}`);
  await page.getByText('Guest claim links (optional)',{exact:true}).click();
  await page.getByLabel('Seller label',{exact:true}).fill('Anthony');
  await page.getByLabel('Guest square numbers',{exact:true}).fill('1-10');
  await page.getByRole('checkbox',{name:'I reviewed the offered squares and understand guest claims replace the current public names.'}).check();
  await page.getByRole('button',{name:'Create guest link',exact:true}).click();
  await expect(page.getByRole('article',{name:'Guest link for Anthony'})).toBeVisible();
  await expect(page.getByLabel('Guest link URL')).toHaveValue(guestPath);
  await expect(page.getByText('Family access (optional)',{exact:true})).toBeVisible();
  const guestContext=await browser.newContext();const guestPage=await guestContext.newPage();
  await f.installGuest(guestPage);
  await guestPage.goto(new URL(guestPath,page.url()).href);
  await guestPage.getByRole('gridcell',{name:/^Square 1, available/}).click();
  await guestPage.getByLabel('Name on your squares').fill('Jamie');
  await guestPage.getByRole('button',{name:'Claim 1 square',exact:true}).click();
  await expect(guestPage.getByRole('heading',{name:'Your squares are claimed'})).toBeVisible();
  await page.clock.runFor(15_100);
  await expect(page.getByRole('listitem').filter({hasText:'Jamie · Squares 1 · Claimed through Anthony'})).toBeVisible();
  await page.screenshot({path:info.outputPath('organizer-links.png'),fullPage:true});
  await guestContext.close();
});

test('disconnected prototype completes a simulated claim without app API or service requests',async({page},info)=>{
  const apiRequests:string[]=[];const remoteRequests:string[]=[];
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/'))apiRequests.push(url.pathname);if(!['127.0.0.1','localhost','fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))remoteRequests.push(request.url());});
  await page.goto('/dev/guest-invites');
  await page.getByRole('button',{name:'Create guest link',exact:true}).click();
  await page.getByRole('gridcell',{name:/^Square 1, available/}).click();
  await page.getByLabel('Name on your squares').fill('Jamie');
  await page.getByRole('button',{name:'Claim 1 square',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your squares are claimed'})).toBeVisible();
  await expect(page.getByRole('listitem').filter({hasText:'Jamie'})).toBeVisible();
  expect(apiRequests).toEqual([]);expect(remoteRequests).toEqual([]);
  await page.screenshot({path:info.outputPath('prototype.png'),fullPage:true});
});

test('another guest converges through polling while disconnected without gaining the first guest receipt',async({page,browser})=>{
  const f=await fixture(page);
  const other=await browser.newPage();
  await other.clock.install();
  await other.routeWebSocket(/\/realtime\/v1\/websocket/,async socket=>{
    await socket.close({code:1011,reason:'Test disconnected realtime'});
  });
  await other.route(`**/api/pools/${boardId}/guest`,route=>{
    const state=f.snapshot();
    return route.fulfill({json:{...state,mine:undefined,heldCells:[],holds:state.holds.map(hold=>({...hold,mine:false}))}});
  });
  await other.goto(`http://127.0.0.1:${process.env.PLAYWRIGHT_PORT||5199}${guestPath}`);
  await expect(other.getByRole('gridcell',{name:/^Square 1, available/})).toBeVisible();
  await page.goto(guestPath);
  await page.getByRole('gridcell',{name:/^Square 1, available/}).click();
  await page.getByLabel('Name on your squares').fill('Taylor');
  await page.getByRole('button',{name:'Claim 1 square',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your squares are claimed'})).toBeVisible();
  await other.clock.runFor(15_100);
  await expect(other.getByRole('gridcell',{name:/^Square 1,.*Taylor/})).toHaveAttribute('aria-disabled','true');
  await expect(other.getByRole('status')).toContainText('Reconnecting');
  await expect(other.getByText(code,{exact:true})).toHaveCount(0);
  await expect(other.getByText(payment.detail)).toHaveCount(0);
  await other.close();
});

test('finalized invite offers the game board and no claim controls',async({page})=>{
  const f=await fixture(page);
  await page.route(`**/api/pools/${boardId}/guest`,route=>route.fulfill({json:{...f.snapshot(),stage:'finalized'}}));
  await page.goto(guestPath);
  await expect(page.getByText('Game numbers are locked. You can still follow the board.',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Open game board'})).toHaveAttribute('href','/b/SHARE123');
  await expect(page.getByLabel('Name on your squares')).toHaveCount(0);
});
