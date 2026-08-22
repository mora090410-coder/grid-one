import type { LiveGameData } from '../../../types';

export type ViewerScoreTone = 'live' | 'pregame' | 'manual' | 'stale' | 'final';

export interface ViewerScoreAuthority {
  label: string;
  detail: string;
  tone: ViewerScoreTone;
}

export interface ViewerScoreModel {
  periodLabel: string;
  authority: ViewerScoreAuthority;
  freshness: string | null;
  pollingText: 'Score updates about every minute';
}

export const viewerPeriodLabel = (live: LiveGameData | null): string => {
  if (!live) return 'Score unavailable';
  if (live.state === 'post') return 'Final';
  if (live.state === 'pre') return 'Pregame';
  if (live.period > 4 || live.isOvertime) return `OT · ${live.clock || 'In progress'}`;
  return `Q${Math.max(live.period, 1)} · ${live.clock || 'In progress'}`;
};

export const viewerAuthorityLabel = (
  live: LiveGameData | null,
  liveStatus: string,
  isSynced: boolean,
): ViewerScoreAuthority => {
  if (!live && liveStatus.startsWith('MANUAL')) {
    return { label: 'Manual · awaiting entry', detail: 'The organizer has scoring authority', tone: 'manual' };
  }
  if (live?.isManual) return { label: 'Manual score', detail: 'Entered by the organizer', tone: 'manual' };
  if (!live) return { label: 'Score unavailable', detail: liveStatus || 'Try again shortly', tone: 'stale' };

  const source = live.sourceName || 'Automatic beta score';
  if (live.state === 'post') return { label: 'Final', detail: source, tone: 'final' };
  if (live.freshness === 'refreshing') return { label: 'Refreshing', detail: `${source} · last known score shown`, tone: 'stale' };
  if (live.freshness === 'offline') return { label: 'Offline · last known', detail: source, tone: 'stale' };
  if (live.freshness === 'rejected') return { label: 'Source rejected', detail: 'Organizer review needed', tone: 'stale' };
  if (live.freshness === 'stale') return { label: 'Stale · last known', detail: source, tone: 'stale' };
  if (live.state === 'in' && isSynced) return { label: 'Live', detail: source, tone: 'live' };
  if (live.state === 'pre') return { label: 'Pregame', detail: source, tone: 'pregame' };
  return { label: 'Last known score', detail: source, tone: 'stale' };
};

export const formatViewerFreshness = (live: LiveGameData | null): string | null => {
  if (!live?.retrievedAt) return null;
  const timestamp = new Date(live.retrievedAt);
  if (Number.isNaN(timestamp.getTime())) return null;
  return `Checked ${timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

export const buildViewerScoreModel = ({
  live,
  liveStatus,
  isSynced,
}: {
  live: LiveGameData | null;
  liveStatus: string;
  isSynced: boolean;
}): ViewerScoreModel => ({
  periodLabel: viewerPeriodLabel(live),
  authority: viewerAuthorityLabel(live, liveStatus, isSynced),
  freshness: formatViewerFreshness(live),
  pollingText: 'Score updates about every minute',
});
