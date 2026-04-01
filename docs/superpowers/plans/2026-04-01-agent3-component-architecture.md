# Agent 3 — Component Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `BoardView.tsx` (603 lines) into focused sub-components, fix `CreateContest.tsx` wizard state persistence, clean `HowToRunSquares.tsx` copy, and fix `index.html` meta tags. All new components use `gridone_` key namespace.

**Architecture:** Agent 3 owns full rewrites of `BoardView.tsx` and `CreateContest.tsx`. The extracted components live in `components/board/`. All `sbxpro_*` localStorage keys in these files become `gridone_*` as part of the rewrite — Agent 1 does NOT touch these files. Token-compliant from the start (no raw hex in new code).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4

---

## Pre-flight

- [ ] **Verify tests pass and build is green before starting**

```bash
cd /Users/amm13/00-Projects/GridOneApp && npm run build && npm run test -- --run
```

Expected: build succeeds, all tests pass.

---

## Task 1: Fix `index.html` meta tags

**Files:**
- Modify: `index.html`

Quick fix before the structural work.

- [ ] **Step 1: Read the head section of index.html**

Read `index.html` lines 1–40.

- [ ] **Step 2: Fix twitter:url and twitter:image to use www subdomain**

Find:
```html
<meta name="twitter:url" content="https://getgridone.com/" />
<meta name="twitter:image" content="https://getgridone.com/og-image.jpg" />
```
Replace with:
```html
<meta name="twitter:url" content="https://www.getgridone.com/" />
<meta name="twitter:image" content="https://www.getgridone.com/og-image.jpg" />
```

- [ ] **Step 3: Verify all social meta URLs are consistent**

```bash
grep -n "getgridone.com" index.html
```
Expected: all occurrences use `https://www.getgridone.com/`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: align twitter:url and twitter:image to use www.getgridone.com"
```

---

## Task 2: Fix `pages/HowToRunSquares.tsx` copy

**Files:**
- Modify: `pages/HowToRunSquares.tsx`

- [ ] **Step 1: Read line 41 context**

Read `pages/HowToRunSquares.tsx` lines 35–50.

- [ ] **Step 2: Replace vague copy**

Find:
```tsx
Rather than drawing one by hand, use a digital tool like <strong><Link to="/" className="text-[#FFC72C] hover:underline hover:text-white transition-colors">GridOne</Link></strong>. Set your teams, upload a board photo if you have one, and clean everything up before you publish it.
```
Replace with:
```tsx
Rather than drawing one by hand, use a digital tool like <strong><Link to="/" className="text-gold hover:underline hover:text-white transition-colors">GridOne</Link></strong>. Set your teams, upload a background image of your physical board, and review team names and positions before you publish it.
```

(Also fixes the raw `text-[#FFC72C]` → `text-gold` in the same pass.)

- [ ] **Step 3: Commit**

```bash
git add pages/HowToRunSquares.tsx
git commit -m "fix: clarify board upload and review copy in HowToRunSquares"
```

---

## Task 3: Fix `pages/CreateContest.tsx` — rename key + wizard state persistence

**Files:**
- Modify: `pages/CreateContest.tsx`

Two changes:
1. Rename `sbxpro_tokens` → `gridone_tokens` (lines 108–110)
2. Persist wizard state to `sessionStorage` before auth redirect; restore on mount (lines 76–80)
3. Fix raw hex colors in the file

- [ ] **Step 1: Read the full file**

Read `pages/CreateContest.tsx`.

- [ ] **Step 2: Rename sbxpro_tokens key**

Find (around line 108):
```ts
const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
storedTokens[data.id] = "auth-owner";
localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));
```
Replace with:
```ts
const storedTokens = JSON.parse(localStorage.getItem('gridone_tokens') || '{}');
storedTokens[data.id] = "auth-owner";
localStorage.setItem('gridone_tokens', JSON.stringify(storedTokens));
```

- [ ] **Step 3: Add sessionStorage persistence before auth redirect**

Find (around line 76):
```ts
if (!user) {
    const returnTo = encodeURIComponent('/create');
    navigate(`/login?mode=signup&returnTo=${returnTo}`);
    return;
}
```
Replace with:
```ts
if (!user) {
    try {
        sessionStorage.setItem('gridone_draft_game', JSON.stringify(game));
        sessionStorage.setItem('gridone_draft_board', JSON.stringify(finalBoard));
    } catch {
        // sessionStorage unavailable — user will lose draft state on redirect
    }
    const returnTo = encodeURIComponent('/create');
    navigate(`/login?mode=signup&returnTo=${returnTo}`);
    return;
}
```

- [ ] **Step 4: Add mount restore effect**

In `CreateContest`, find the existing state declarations block (after the `useState` calls, before any event handlers). Add a `useEffect` import if not already present, then add:

```ts
// Restore wizard draft if user was redirected away from /create for auth
useEffect(() => {
    const savedGame = sessionStorage.getItem('gridone_draft_game');
    const savedBoard = sessionStorage.getItem('gridone_draft_board');
    if (savedGame) {
        try { setGame(JSON.parse(savedGame)); } catch { /* corrupt data */ }
        sessionStorage.removeItem('gridone_draft_game');
    }
    if (savedBoard) {
        try { setBoard(JSON.parse(savedBoard)); } catch { /* corrupt data */ }
        sessionStorage.removeItem('gridone_draft_board');
    }
}, []); // Run once on mount
```

- [ ] **Step 5: Fix raw hex colors**

Replace the following raw hex values in this file:
- `bg-[#050505]` → `bg-background`
- `bg-[#9D2235]` → `bg-cardinal`
- `bg-[#1c1c1e]` → `bg-surface`

- [ ] **Step 6: Verify no sbxpro or raw hex remains**

```bash
grep -n "sbxpro\|#[0-9a-fA-F]\{3,6\}" pages/CreateContest.tsx
```
Expected: no output.

- [ ] **Step 7: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error"
```

- [ ] **Step 8: Commit**

```bash
git add pages/CreateContest.tsx
git commit -m "fix: persist wizard draft state before auth redirect in CreateContest; rename sbxpro_tokens"
```

---

## Task 4: Create `components/board/` directory and extract `BoardHeader`

**Files:**
- Create: `components/board/BoardHeader.tsx`
- Modify: `components/BoardView.tsx`

The `renderHeader()` function inside `BoardViewContent` renders two header variants (admin/preview vs public). Extract it as a proper component.

- [ ] **Step 1: Read BoardView.tsx in full**

Read `components/BoardView.tsx` — especially the `renderHeader()` function and the props it closes over.

The `renderHeader()` function uses these from `BoardViewContent` scope:
- `adminToken`, `isOwner` — determine which variant to show
- `game.title`, `game.leftAbbr`, `game.topAbbr`, `game.dates`
- `activePoolId`, `isActivated`
- `isSynced`
- `activeTab`, `setActiveTab`
- `isPreviewMode`, `handleTogglePreview`
- `adminStartTab`, `setAdminStartTab`
- `showShareModal`, `setShowShareModal`

- [ ] **Step 2: Create `components/board/BoardHeader.tsx`**

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { GameState } from '../../types';

interface BoardHeaderProps {
    game: GameState;
    adminToken: string;
    isOwner: boolean;
    activePoolId: string | null;
    isActivated: boolean;
    isSynced: boolean;
    activeTab: 'live' | 'board';
    onTabChange: (tab: 'live' | 'board') => void;
    isPreviewMode: boolean;
    onTogglePreview: (enabled: boolean) => void;
    adminStartTab: 'overview' | 'edit';
    onAdminStartTab: (tab: 'overview' | 'edit') => void;
    onShareClick: () => void;
}

const BoardHeader: React.FC<BoardHeaderProps> = ({
    game,
    adminToken,
    isOwner,
    activePoolId,
    isActivated,
    isSynced,
    activeTab,
    onTabChange,
    isPreviewMode,
    onTogglePreview,
    adminStartTab,
    onAdminStartTab,
    onShareClick,
}) => {
    const showAdminHeader = (adminToken || isOwner) && !isPreviewMode;

    if (showAdminHeader) {
        return (
            <div className="premium-glass px-4 md:px-5 py-3 rounded-2xl flex items-center justify-between gap-4 backdrop-blur-2xl border border-white/10 shadow-2xl mb-6">
                <Link to="/dashboard" className="flex items-center gap-3 min-w-0 group cursor-pointer">
                    <div className="w-9 h-9 rounded-xl bg-black/20 group-hover:bg-white/10 flex items-center justify-center shadow-md border border-white/10 hover:border-white/20 transition-all flex-shrink-0 overflow-hidden ring-1 ring-gold/50">
                        <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-white tracking-tight group-hover:text-gold transition-colors">Organizer</h3>
                        <p className="text-xs font-medium text-white/50 truncate group-hover:text-white/70 transition-colors">
                            {game.title || 'Untitled board'}
                        </p>
                    </div>
                </Link>

                <div className="hidden md:flex items-center bg-black/30 p-0.5 rounded-full border border-white/[0.08]">
                    <button
                        onClick={() => { onAdminStartTab('overview'); onTogglePreview(false); }}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold text-white/50 hover:text-white transition-colors"
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => { onAdminStartTab('edit'); onTogglePreview(false); }}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold text-white/50 hover:text-white transition-colors"
                    >
                        Edit
                    </button>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <button className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-black shadow-sm">
                        Preview
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-[13px] font-semibold text-white/50">Saved</span>
                    </div>
                    {activePoolId && isActivated && (
                        <button onClick={onShareClick} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all" title="Share Board">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        </button>
                    )}
                    <button onClick={() => onTogglePreview(false)} className="md:hidden px-4 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white border border-white/10 hover:bg-white hover:text-black transition-all">
                        Edit
                    </button>
                </div>
            </div>
        );
    }

    // Public header
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <a href="/dashboard" className="w-10 h-10 rounded-xl bg-black/20 hover:bg-white/10 flex items-center justify-center shadow-lg border border-white/10 hover:border-white/20 transition-all overflow-hidden cursor-pointer group ring-1 ring-gold/50">
                    <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                </a>
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold leading-none tracking-tight text-white mb-1">{game.title || 'Super Bowl LIX'}</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-white/60 font-medium">
                            {game.leftAbbr} vs {game.topAbbr} • {game.dates || 'Feb 9, 2025'}
                        </span>
                        {isSynced && <span className="w-1.5 h-1.5 rounded-full bg-live shadow-[0_0_8px_var(--color-live)]" title="Live Sync Active" />}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center bg-white/10 p-0.5 rounded-full border border-white/5">
                    <button onClick={() => onTabChange('live')} className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all ${activeTab === 'live' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}>Live</button>
                    <button onClick={() => onTabChange('board')} className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all ${activeTab === 'board' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}>Board</button>
                </div>
                {activePoolId && isActivated && (
                    <button onClick={onShareClick} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white border border-white/5">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default BoardHeader;
```

- [ ] **Step 3: Build to confirm component compiles**

```bash
npm run build 2>&1 | grep -E "error|Error"
```

- [ ] **Step 4: Commit**

```bash
git add components/board/BoardHeader.tsx
git commit -m "feat: extract BoardHeader component from BoardView"
```

---

## Task 5: Extract modal components from `BoardView.tsx`

**Files:**
- Create: `components/board/JoinModal.tsx`
- Create: `components/board/ShareModal.tsx`
- Create: `components/board/FindSquaresModal.tsx`
- Create: `components/board/PayoutsModal.tsx`
- Create: `components/board/RecoveryModal.tsx`

- [ ] **Step 1: Create `components/board/JoinModal.tsx`**

```tsx
import React from 'react';

interface JoinModalProps {
    joinInput: string;
    onJoinInputChange: (value: string) => void;
    onSubmit: () => void;
    onClose: () => void;
    isJoining: boolean;
    showCommissionerEntry: boolean;
}

const JoinModal: React.FC<JoinModalProps> = ({
    joinInput,
    onJoinInputChange,
    onSubmit,
    onClose,
    isJoining,
    showCommissionerEntry,
}) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-white/20">
            <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Join Game</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Enter the Game Code shared by your Commissioner.</p>
                <input
                    autoFocus
                    type="text"
                    value={joinInput}
                    onChange={(e) => onJoinInputChange(e.target.value)}
                    placeholder="Game Code"
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-white/40 outline-none font-mono uppercase"
                />
                <button
                    type="submit"
                    disabled={isJoining}
                    className="w-full btn-cardinal py-3 rounded text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50"
                >
                    {isJoining ? 'Verifying...' : showCommissionerEntry ? 'Enter Commissioner Hub' : 'Enter Stadium'}
                </button>
            </form>
        </div>
    </div>
);

export default JoinModal;
```

- [ ] **Step 2: Create `components/board/RecoveryModal.tsx`**

```tsx
import React from 'react';

interface RecoveryModalProps {
    email: string;
    onEmailChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
    isRecovering: boolean;
}

const RecoveryModal: React.FC<RecoveryModalProps> = ({
    email,
    onEmailChange,
    onSubmit,
    onClose,
    isRecovering,
}) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-white/20">
            <form onSubmit={onSubmit} className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Recover Board ID</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <p className="text-[11px] text-gray-400 leading-tight">Enter the email you used during setup.</p>
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">Email Address</label>
                    <input
                        autoFocus
                        type="email"
                        value={email}
                        onChange={(e) => onEmailChange(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-white/40 outline-none"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isRecovering}
                    className="w-full btn-secondary py-2 rounded text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50"
                >
                    {isRecovering ? 'Sending...' : 'Send Recovery Email'}
                </button>
            </form>
        </div>
    </div>
);

export default RecoveryModal;
```

- [ ] **Step 3: Create `components/board/ShareModal.tsx`**

```tsx
import React, { useState } from 'react';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';

interface ShareModalProps {
    shareUrl: string;
    onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ shareUrl, onClose }) => {
    const [copyFeedback, setCopyFeedback] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="premium-glass w-full max-w-sm p-6 text-center flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                <h2 className="text-lg font-semibold text-white tracking-tight">Share link</h2>
                <div className="bg-white p-4 rounded-xl shadow-lg">
                    <QRCodeSVG value={shareUrl} size={160} />
                </div>
                <div className="bg-black/20 border border-white/5 rounded-lg p-3 flex items-center gap-3 w-full">
                    <div className="flex-1 text-xs font-mono text-gray-400 truncate text-left">{shareUrl}</div>
                    <button
                        onClick={handleCopy}
                        className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        {copyFeedback ? 'Copied' : 'Copy'}
                    </button>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight px-4">
                    <span className="font-bold text-white/60">Note:</span> This link gives <span className="text-white/60">read-only access</span> to viewers. Organizers keep edit access inside their GridOne account.
                </p>
                <button onClick={onClose} className="w-full btn-secondary text-sm">Close</button>
            </div>
        </div>
    );
};

export default ShareModal;
```

- [ ] **Step 4: Create `components/board/FindSquaresModal.tsx`**

```tsx
import React from 'react';
import PlayerFilter from '../PlayerFilter';
import { BoardData } from '../../types';

interface FindSquaresModalProps {
    board: BoardData;
    selectedPlayer: string;
    onSelectPlayer: (player: string) => void;
    onClose: () => void;
}

const FindSquaresModal: React.FC<FindSquaresModalProps> = ({
    board,
    selectedPlayer,
    onSelectPlayer,
    onClose,
}) => (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md mx-4 bg-surface border border-white/10 rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Find my squares</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                        <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <PlayerFilter
                    board={board}
                    setSelected={(player) => { onSelectPlayer(player); onClose(); }}
                    selected={selectedPlayer}
                />
                {selectedPlayer && (
                    <button
                        onClick={() => { onSelectPlayer(''); onClose(); }}
                        className="w-full mt-4 py-2 text-sm font-medium text-white/50 hover:text-white transition-colors"
                    >
                        Clear selection
                    </button>
                )}
            </div>
        </div>
    </div>
);

export default FindSquaresModal;
```

- [ ] **Step 5: Create `components/board/PayoutsModal.tsx`**

```tsx
import React from 'react';
import { InfoCards } from '../InfoCards';
import { GameState, BoardData, LiveGameData, WinnerHighlights } from '../../types';

interface PayoutsModalProps {
    game: GameState;
    board: BoardData;
    live: LiveGameData | null;
    liveStatus: string;
    lastUpdated: string | null;
    highlights: WinnerHighlights;
    onClose: () => void;
}

const PayoutsModal: React.FC<PayoutsModalProps> = ({
    game, board, live, liveStatus, lastUpdated, highlights, onClose,
}) => (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto bg-surface border border-white/10 rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
            <div className="sticky top-0 z-10 bg-surface p-4 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Payouts</h3>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                    <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div className="p-4">
                <InfoCards.PayoutsAccordion
                    liveStatus={liveStatus}
                    lastUpdated={lastUpdated}
                    highlights={highlights}
                    board={board}
                    live={live}
                    game={game}
                />
            </div>
        </div>
    </div>
);

export default PayoutsModal;
```

Note: If `InfoCards` does not export as a namespace with `.PayoutsAccordion`, check the actual export in `components/InfoCards.tsx` and update the import accordingly.

- [ ] **Step 6: Build to confirm all new components compile**

```bash
npm run build 2>&1 | grep -E "error|Error"
```

Fix any TypeScript errors from the PayoutsModal InfoCards import — adjust the import path to match the actual export style in `InfoCards.tsx`.

- [ ] **Step 7: Commit**

```bash
git add components/board/
git commit -m "feat: extract modal components (Join, Share, Recovery, FindSquares, Payouts) from BoardView"
```

---

## Task 6: Rewrite `components/BoardView.tsx` as thin orchestrator

**Files:**
- Modify: `components/BoardView.tsx`

Replace the current 603-line file with a version that uses the extracted components. All `sbxpro_*` keys become `gridone_*`.

- [ ] **Step 1: Read current BoardView.tsx in full to understand all state and effects**

(Already done above — refer to the full read from the pre-plan research.)

- [ ] **Step 2: Write the new BoardView.tsx**

Replace the entire content of `components/BoardView.tsx` with:

```tsx
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { WinnerHighlights } from '../types';
import { SAMPLE_BOARD } from '../constants';

import BoardGrid from './BoardGrid';
import InfoCards from './InfoCards';
import ScenarioPanel from './ScenarioPanel';
import LandingPage from './LandingPage';
import ErrorBoundary from './ErrorBoundary';
import FullScreenLoading from './loading/FullScreenLoading';
import BoardHeader from './board/BoardHeader';
import JoinModal from './board/JoinModal';
import RecoveryModal from './board/RecoveryModal';
import ShareModal from './board/ShareModal';
import FindSquaresModal from './board/FindSquaresModal';
import PayoutsModal from './board/PayoutsModal';

import { usePoolData, INITIAL_GAME } from '../hooks/usePoolData';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { useAuth } from '../hooks/useAuth';
import { useBoardActions } from '../hooks/useBoardActions';
import { WizardModal } from './BoardWizard/WizardModal';

const AdminPanel = lazy(() => import('./AdminPanel'));

const API_URL = `${window.location.origin}/api/pools`;

const BoardViewContent: React.FC<{ demoMode?: boolean }> = ({ demoMode = false }) => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlPoolId = searchParams.get('poolId');
    const forceAdmin = searchParams.get('forceAdmin') === 'true';
    const navigate = useNavigate();

    // Data
    const poolData = usePoolData();
    const {
        game, setGame, board, setBoard, activePoolId, setActivePoolId,
        ownerId, loadingPool, dataReady, loadPoolData, isActivated, isPaid,
    } = poolData;

    const { liveData, liveStatus, isSynced, lastUpdated } = useLiveScoring(game, dataReady, loadingPool);
    const auth = useAuth();
    const { adminToken, setAdminToken } = auth;

    // Auth guard for admin/empty routes
    const requiresAuthForRoute = !demoMode && (forceAdmin || !urlPoolId);
    useEffect(() => {
        if (requiresAuthForRoute && !auth.loading && !auth.user && !loadingPool) {
            navigate(`/login?returnTo=${encodeURIComponent(window.location.search)}`);
        }
    }, [auth.loading, auth.user, loadingPool, navigate, requiresAuthForRoute]);

    if (requiresAuthForRoute && !auth.loading && !auth.user) {
        return <FullScreenLoading message="Sign in required..." />;
    }

    // UI State
    const [showShareModal, setShowShareModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showWizardModal, setShowWizardModal] = useState(false);
    const [showAdminView, setShowAdminView] = useState(false);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [showFindSquaresModal, setShowFindSquaresModal] = useState(false);
    const [showPayoutsModal, setShowPayoutsModal] = useState(false);
    const [adminStartTab, setAdminStartTab] = useState<'overview' | 'edit'>('overview');
    const [joinInput, setJoinInput] = useState('');
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [activeTab, setActiveTab] = useState<'live' | 'board'>('live');
    const [hasEnteredApp, setHasEnteredApp] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(
        () => localStorage.getItem('gridone_preview_mode') === 'true'
    );
    const [selectedPlayer, setSelectedPlayer] = useState('');
    const [highlightedCoords, setHighlightedCoords] = useState<{ left: number; top: number } | null>(null);

    const { handlePublish, handleJoinSubmit, isJoining } = useBoardActions({
        game, board, activePoolId, API_URL, setAdminToken, setShowAdminView,
    });

    // Derived
    const showLanding = !demoMode && !activePoolId && !urlPoolId && !loadingPool && !hasEnteredApp && !isInitialized;
    const isOwner = !!(auth.user && ownerId && auth.user.id === ownerId);
    const isCommissionerMode = (showAdminView && !!adminToken && !isPreviewMode) || (isOwner && !isPreviewMode);

    const knownAdminToken = useMemo(() => {
        const targetId = joinInput.trim().toUpperCase() || activePoolId;
        if (!targetId || targetId.length < 4) return null;
        const stored = JSON.parse(localStorage.getItem('gridone_tokens') || '{}');
        return stored[targetId] || null;
    }, [joinInput, activePoolId]);

    const isEmptyBoard = !board.squares.some(s => s.length > 0);

    const highlights = useMemo<WinnerHighlights>(() => {
        if (!liveData) return { quarterWinners: {}, currentLabel: 'NOW' };
        const { period, state, quarterScores, leftScore, topScore, isManual } = liveData;
        if (isManual) return { quarterWinners: {}, currentLabel: 'NOW' };

        const qw: Record<string, string> = {};
        const getWinnerKey = (qIdx: number) => {
            let lSum = 0; let tSum = 0;
            for (let i = 0; i <= qIdx; i++) {
                const qKey = `Q${i + 1}` as keyof typeof quarterScores;
                lSum += (quarterScores[qKey]?.left || 0);
                tSum += (quarterScores[qKey]?.top || 0);
            }
            return `${tSum % 10}-${lSum % 10}`;
        };

        if (period > 1 || state === 'post') qw['Q1'] = getWinnerKey(0);
        if (period > 2 || state === 'post') qw['Q2'] = getWinnerKey(1);
        if (period > 3 || state === 'post') qw['Q3'] = getWinnerKey(2);
        if (state === 'post') qw['Final'] = `${topScore % 10}-${leftScore % 10}`;

        return { quarterWinners: qw, currentLabel: state === 'post' ? 'FINAL' : 'NOW' };
    }, [liveData]);

    // Effects
    useEffect(() => { if (isOwner) setShowAdminView(true); }, [isOwner]);

    useEffect(() => {
        if (demoMode) {
            setBoard(SAMPLE_BOARD);
            setGame({ ...INITIAL_GAME, title: 'Demo: Super Bowl LIX', leftAbbr: 'KC', topAbbr: 'SF' });
            setIsInitialized(true);
            setHasEnteredApp(true);
            setActiveTab('board');
        }
    }, [demoMode, setBoard, setGame]);

    useEffect(() => {
        if (!urlPoolId) return;
        if (forceAdmin) {
            setIsPreviewMode(false);
            setShowAdminView(true);
            localStorage.setItem('gridone_preview_mode', 'false');
        }
        loadPoolData(urlPoolId).then(() => {
            setIsInitialized(true);
            const stored = JSON.parse(localStorage.getItem('gridone_tokens') || '{}');
            if (stored[urlPoolId]) setAdminToken(stored[urlPoolId]);
        });
    }, [loadPoolData, setAdminToken, urlPoolId]);

    useEffect(() => {
        if (dataReady && !loadingPool && !isActivated && !isOwner && !demoMode) {
            setActiveTab('board');
        }
    }, [dataReady, loadingPool, isActivated, isOwner, demoMode]);

    useEffect(() => {
        if (urlPoolId || !dataReady || loadingPool) return;
        localStorage.setItem('squares_game', JSON.stringify(game));
        localStorage.setItem('squares_board', JSON.stringify(board));
    }, [game, board, dataReady, loadingPool, urlPoolId]);

    // Handlers
    const handleTogglePreview = (enabled: boolean) => {
        setIsPreviewMode(enabled);
        localStorage.setItem('gridone_preview_mode', String(enabled));
        setShowAdminView(!enabled);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        const stored = JSON.parse(localStorage.getItem('gridone_tokens') || '{}');
        if (activePoolId) delete stored[activePoolId];
        localStorage.setItem('gridone_tokens', JSON.stringify(stored));
        setAdminToken('');
        setHasEnteredApp(false);
        setActivePoolId(null);
        setIsInitialized(false);
        setShowAdminView(false);
        setIsPreviewMode(false);
        localStorage.removeItem('gridone_preview_mode');
        setBoard(SAMPLE_BOARD);
        navigate('/');
    };

    const handleRecoverySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recoveryEmail || !recoveryEmail.includes('@')) return;
        setIsRecovering(true);
        try {
            const res = await fetch(`${API_URL}/recovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: recoveryEmail }),
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || 'Recovery email sent.');
                setShowRecoveryModal(false);
                setRecoveryEmail('');
            } else {
                alert('Recovery failed: ' + (data.error || 'Unknown error'));
            }
        } catch {
            alert('Network error during recovery.');
        } finally {
            setIsRecovering(false);
        }
    };

    const shareUrl = activePoolId
        ? `${window.location.origin}/?poolId=${activePoolId}`
        : window.location.href;

    const renderMainContent = (previewMode = false) => {
        const effectiveTab = previewMode ? 'live' : activeTab;

        return (
            <div className="flex-1 relative overflow-hidden flex flex-col pb-6">
                <div className={`flex-1 flex flex-col h-full overflow-hidden ${isOwner && !isPaid ? 'blur-sm pointer-events-none select-none' : ''}`}>
                    <InfoCards.LiveStrip
                        game={game}
                        live={liveData}
                        isSynced={isSynced}
                        activeTab={effectiveTab}
                        onTabChange={previewMode ? undefined : setActiveTab}
                    />

                    <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
                        <div className="max-w-[960px] mx-auto px-4 md:px-6 py-6 space-y-6">
                            {effectiveTab === 'live' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    {liveStatus === 'NO MATCH FOUND' && (
                                        <div className="p-4 rounded-[20px] bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-4">
                                            <div className="p-2 rounded-full bg-yellow-500/20 text-yellow-500">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-yellow-500 mb-1">No game found for selected teams/date</h4>
                                                <p className="text-xs text-yellow-500/80">
                                                    No matchup found for {game.leftAbbr} vs {game.topAbbr}{game.dates ? ` on ${game.dates}` : ''}. Go to Organizer &gt; Edit to change teams or date.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <InfoCards.WinningNowHero game={game} board={board} live={liveData} highlights={highlights} />
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <ScenarioPanel.LeftScenarios game={game} board={board} live={liveData} onScenarioHover={setHighlightedCoords} />
                                        <ScenarioPanel.TopScenarios game={game} board={board} live={liveData} onScenarioHover={setHighlightedCoords} />
                                    </div>
                                </div>
                            )}

                            {effectiveTab === 'board' && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <button
                                                onClick={() => setShowFindSquaresModal(true)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-[13px] font-semibold text-white/70 hover:bg-white/[0.08] hover:text-white transition-all shrink-0"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                <span className="hidden sm:inline">Find my squares</span>
                                            </button>
                                            {selectedPlayer && (
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 animate-in fade-in duration-200 min-w-0">
                                                    <span className="text-xs font-medium text-white truncate">Showing: {selectedPlayer}</span>
                                                    <button onClick={() => setSelectedPlayer('')} className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0">
                                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="relative bg-surface/40 border border-white/[0.08] rounded-2xl shadow-xl min-h-[500px] overflow-auto">
                                        <div className="p-3 md:p-4 flex items-start justify-center min-h-full">
                                            {isEmptyBoard ? (
                                                <div className="text-center max-w-sm mx-auto p-8 animate-in fade-in zoom-in duration-500">
                                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                                                        <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                                    </div>
                                                    <h3 className="text-xl font-semibold text-white mb-2">Board is empty</h3>
                                                    <p className="text-sm text-gray-500 mb-8 leading-relaxed">The organizer hasn't added names yet.</p>
                                                </div>
                                            ) : (
                                                <div className="w-full max-w-[980px] min-w-[620px] sm:min-w-[700px] transition-transform duration-300">
                                                    <BoardGrid
                                                        board={board}
                                                        highlights={highlights}
                                                        live={liveData}
                                                        selectedPlayer={selectedPlayer}
                                                        highlightedCoords={highlightedCoords}
                                                        leftTeamName={game.leftName || game.leftAbbr}
                                                        topTeamName={game.topName || game.topAbbr}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-center mt-8 pb-4 animate-in fade-in duration-500 delay-300">
                                        <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all group">
                                            <span className="text-xs text-white/50 font-medium group-hover:text-white/70 transition-colors">Powered by</span>
                                            <div className="flex items-center gap-1.5">
                                                <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                                <span className="text-xs font-bold text-white tracking-tight group-hover:text-gold transition-colors">GridOne</span>
                                            </div>
                                            <div className="w-px h-3 bg-white/10 mx-1" />
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-gold/70 group-hover:text-gold transition-colors">Build yours &rarr;</span>
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-screen w-full bg-background overflow-hidden flex flex-col font-sans text-white">
            {/* Modals */}
            {showRecoveryModal && (
                <RecoveryModal
                    email={recoveryEmail}
                    onEmailChange={setRecoveryEmail}
                    onSubmit={handleRecoverySubmit}
                    onClose={() => setShowRecoveryModal(false)}
                    isRecovering={isRecovering}
                />
            )}
            {showJoinModal && (
                <JoinModal
                    joinInput={joinInput}
                    onJoinInputChange={setJoinInput}
                    onSubmit={() => handleJoinSubmit(joinInput)}
                    onClose={() => setShowJoinModal(false)}
                    isJoining={isJoining}
                    showCommissionerEntry={!!knownAdminToken}
                />
            )}
            {showShareModal && (
                <ShareModal shareUrl={shareUrl} onClose={() => setShowShareModal(false)} />
            )}
            {showFindSquaresModal && (
                <FindSquaresModal
                    board={board}
                    selectedPlayer={selectedPlayer}
                    onSelectPlayer={setSelectedPlayer}
                    onClose={() => setShowFindSquaresModal(false)}
                />
            )}
            {showPayoutsModal && (
                <PayoutsModal
                    game={game}
                    board={board}
                    live={liveData}
                    liveStatus={liveStatus}
                    lastUpdated={lastUpdated}
                    highlights={highlights}
                    onClose={() => setShowPayoutsModal(false)}
                />
            )}

            <WizardModal
                isOpen={showWizardModal}
                onClose={() => setShowWizardModal(false)}
                game={game}
                setGame={setGame}
                board={board}
                setBoard={setBoard}
                onPublish={handlePublish}
                API_URL={API_URL}
                onSuccess={() => {
                    setIsInitialized(true);
                    setIsPreviewMode(false);
                    setShowAdminView(true);
                    setActiveTab('board');
                    setTimeout(() => {
                        setHasEnteredApp(true);
                        setShowWizardModal(false);
                        setShowShareModal(true);
                    }, 1800);
                }}
            />

            {loadingPool && urlPoolId && <FullScreenLoading />}

            {!loadingPool && showLanding ? (
                <LandingPage onCreate={() => navigate('/create')} onLogin={() => navigate('/login')} />
            ) : !loadingPool && (
                <div className="flex-1 flex flex-col relative z-50 w-full max-w-6xl mx-auto md:px-6 h-full">
                    <div className="flex-shrink-0 z-50 p-4 md:py-6">
                        <BoardHeader
                            game={game}
                            adminToken={adminToken}
                            isOwner={isOwner}
                            activePoolId={activePoolId}
                            isActivated={isActivated}
                            isSynced={isSynced}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            isPreviewMode={isPreviewMode}
                            onTogglePreview={handleTogglePreview}
                            adminStartTab={adminStartTab}
                            onAdminStartTab={setAdminStartTab}
                            onShareClick={() => setShowShareModal(true)}
                        />
                    </div>
                    {renderMainContent()}
                </div>
            )}

            {isCommissionerMode && (
                <div className="fixed inset-0 z-[80] bg-background p-0 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300 scrollbar-hide">
                    <Suspense fallback={<div className="flex items-center justify-center h-full text-white/50">Loading Organizer...</div>}>
                        <AdminPanel
                            game={game}
                            board={board}
                            adminToken={adminToken || ''}
                            activePoolId={activePoolId || ''}
                            liveData={liveData}
                            initialTab={adminStartTab}
                            onApply={(g, b) => { setGame(g); setBoard(b); }}
                            onPublish={handlePublish}
                            onLogout={handleLogout}
                            isActivated={isActivated}
                            renderPreview={() => (
                                <div className="flex-1 flex flex-col relative z-50 w-full h-full">
                                    {renderMainContent(true)}
                                </div>
                            )}
                        />
                    </Suspense>
                </div>
            )}
        </div>
    );
};

const BoardView: React.FC<{ demoMode?: boolean }> = ({ demoMode }) => (
    <ErrorBoundary>
        <BoardViewContent demoMode={demoMode} />
    </ErrorBoundary>
);

export default BoardView;
```

- [ ] **Step 3: Verify no sbxpro references remain**

```bash
grep -n "sbxpro" components/BoardView.tsx
```
Expected: no output.

- [ ] **Step 4: Verify no raw hex remains**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" components/BoardView.tsx
```
Expected: no output.

- [ ] **Step 5: Build to confirm**

```bash
npm run build 2>&1 | grep -E "error|Error"
```

Resolve any TypeScript errors — they will be prop type mismatches or missing imports. Fix them by reading the actual component signatures.

- [ ] **Step 6: Run tests**

```bash
npm run test -- --run
```

- [ ] **Step 7: Commit**

```bash
git add components/BoardView.tsx
git commit -m "refactor: rewrite BoardView as thin orchestrator using extracted board/ sub-components"
```

---

## Task 7: Review `pages/Dashboard.tsx` for component extraction

**Files:**
- Modify: `pages/Dashboard.tsx` (possibly)
- Create: `components/dashboard/ContestList.tsx` (if extraction is warranted)

- [ ] **Step 1: Read Dashboard.tsx in full**

Read `pages/Dashboard.tsx`.

- [ ] **Step 2: Evaluate extraction**

If the contest list rendering (the `contests.map(...)` JSX) is 50+ lines and the guest migration flow adds another 50+ lines on top, extract `ContestList.tsx`. Otherwise, limit changes to fixing any raw hex colors and leaving the file structurally as-is.

Rule: only extract if the resulting files are meaningfully simpler. Do not split for the sake of splitting.

- [ ] **Step 3: Fix any raw hex colors in Dashboard.tsx**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" pages/Dashboard.tsx
```
Replace using this mapping: `#0B0C0F`/`#050505`/`#060607` → `bg-background`, `#1c1c1e` → `bg-surface`, `#8F1D2C`/`#9D2235` → `bg-cardinal`/`text-cardinal`/`border-cardinal`, `#FFC72C` → `bg-gold`/`text-gold`.

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error"
```

- [ ] **Step 5: Commit if changes were made**

```bash
git add pages/Dashboard.tsx components/dashboard/
git commit -m "refactor: clean Dashboard.tsx raw colors and extract ContestList if warranted"
```

---

## Post-flight

- [ ] **Verify BoardView.tsx line count is under 250**

```bash
wc -l components/BoardView.tsx
```

- [ ] **No sbxpro anywhere in Agent 3 scope**

```bash
grep -rn "sbxpro" components/BoardView.tsx components/board/ pages/CreateContest.tsx pages/Dashboard.tsx pages/HowToRunSquares.tsx index.html
```
Expected: no output.

- [ ] **Full build and test green**

```bash
npm run build && npm run test -- --run
```
Expected: build succeeds, all tests pass.
