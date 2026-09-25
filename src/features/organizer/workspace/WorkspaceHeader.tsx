import React, { useEffect, useRef, useState } from 'react';
import { Eyebrow, CapsuleButton, CapsuleTag, Logo, Sheet } from '../../../design/primitives';
import type { DraftSaveState } from '../draft/draftSaveModel';
import type { ScheduledGame, GameState } from '../../../../types';
import ScheduledGamePicker from '../../../../components/ScheduledGamePicker';

export interface WorkspaceHeaderProps {
  game: GameState;
  saveState: DraftSaveState;
  isPublished: boolean;
  onTitleChange: (title: string) => void;
  onGameChange?: (game: ScheduledGame) => void;
  onRetry: () => void;
  onReload: () => void;
  onLogout: () => void;
  actions?: React.ReactNode;
}

function formatKickoff(game: GameState): string {
  if (game.kickoffAt) {
    const parsed = new Date(game.kickoffAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  return game.dates || 'Kickoff not set';
}

function SavePill({ saveState, onRetry, onReload }: { saveState: DraftSaveState; onRetry: () => void; onReload: () => void }) {
  switch (saveState.status) {
    case 'conflicted':
      return (
        <div role="alert" className="flex items-center gap-2 font-mono text-[12px] text-tone-cardinal">
          <span>This board changed in another session.</span>
          <CapsuleButton variant="quiet" size="md" onClick={onReload}>Reload latest board</CapsuleButton>
        </div>
      );
    case 'save_failed':
      return (
        <div role="status" className="flex items-center gap-2 font-mono text-[12px] text-tone-cardinal">
          <span>Save failed</span>
          <CapsuleButton variant="quiet" size="md" onClick={onRetry}>Retry</CapsuleButton>
        </div>
      );
    case 'saving':
      return <div role="status" className="font-mono text-[12px] text-fg-3">Saving…</div>;
    case 'dirty':
      return <div role="status" className="font-mono text-[12px] text-fg-3">Unsaved changes</div>;
    case 'recovered':
      return <div role="status" className="font-mono text-[12px] text-fg-3">Recovered draft · review before publishing</div>;
    case 'clean':
    default:
      return <div role="status" className="font-mono text-[12px] text-fg-3">Saved</div>;
  }
}

export default function WorkspaceHeader({
  game,
  saveState,
  isPublished,
  onTitleChange,
  onGameChange,
  onRetry,
  onReload,
  onLogout,
  actions,
}: WorkspaceHeaderProps) {
  const [title, setTitle] = useState(game.title);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastCommitted = useRef(game.title);

  // Resync from props when the input isn't focused -- otherwise a server
  // round-trip (or a sibling update) would clobber what the user is typing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setTitle(game.title);
      lastCommitted.current = game.title;
    }
  }, [game.title]);

  const commitTitle = () => {
    const trimmed = title.trim();
    if (isPublished) return;
    if (trimmed !== lastCommitted.current) {
      onTitleChange(trimmed);
      lastCommitted.current = trimmed;
    }
  };

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-4">
        <a href="/" className="inline-flex min-h-11 items-center rounded-control focus-visible:ring-2 focus-visible:ring-action"><Logo size={28} /></a>
        <a href="/dashboard" className="inline-flex min-h-11 w-fit items-center rounded-control font-ui text-[14px] text-fg-2 focus-visible:ring-2 focus-visible:ring-action">My boards</a>
      </div>
      {isPublished
        ? <div><CapsuleTag tone="turf">Published</CapsuleTag></div>
        : <SavePill saveState={saveState} onRetry={onRetry} onReload={onReload} />}
      </div>
      <div className="flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row [&>*:first-child]:min-w-0 [&>*:first-child]:w-full [&>*:first-child]:flex-1">
        <div className="flex-1 min-w-0">
          <Eyebrow>{isPublished ? 'Published board' : 'Organizer'}</Eyebrow>
          <input
            ref={inputRef}
            aria-label="Board name"
            className="font-display text-[34px] md:text-[44px] leading-[1.05] bg-transparent border-0 p-0 w-full text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-action rounded-control"
            value={title}
            readOnly={isPublished}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTitle();
                inputRef.current?.blur();
              }
            }}
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0">
            <p className="font-ui text-[15px] text-fg-2">
              {game.leftAbbr} at {game.topAbbr} · {formatKickoff(game)}
            </p>
            {!isPublished && (
              <CapsuleButton variant="ghost" size="md" onClick={() => setPickerOpen(true)}>
                Change game
              </CapsuleButton>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}<CapsuleButton variant="ghost" size="md" onClick={onLogout}>Log out</CapsuleButton></div>
      </div>
      {!isPublished && (
        <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Pick the game">
          <p className="font-ui text-[14px] text-fg-2">Changing the game clears any score state on this board.</p>
          <ScheduledGamePicker
            value={game.gameExternalId ?? null}
            onChange={(picked) => {
              onGameChange?.(picked);
              setPickerOpen(false);
            }}
          />
        </Sheet>
      )}
    </header>
  );
}
