import React from 'react';
import type { BoardData, GameState, LiveGameData } from '../../../../types';
import { buildScenarioModel, type ViewerScenario } from './scenarioModel';

export interface ScenarioDisclosureProps {
  board: BoardData;
  game: GameState;
  live: LiveGameData | null;
  selectedPlayer: string;
  servicesEnabled: boolean;
  onScenarioFocus: (coords: { left: number; top: number } | null) => void;
}

const lastKnownCopy = (checkedAt: string | null): string => {
  if (!checkedAt) return 'Using last-known score until scoring reconnects.';
  const timestamp = new Date(checkedAt);
  if (Number.isNaN(timestamp.getTime())) return 'Using last-known score until scoring reconnects.';
  return `Using the last-known score checked ${timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} until scoring reconnects.`;
};

const ScenarioDisclosure: React.FC<ScenarioDisclosureProps> = ({ board, game, live, selectedPlayer, servicesEnabled, onScenarioFocus }) => {
  const titleId = React.useId();
  if (!servicesEnabled) return <p className="font-ui text-[15px] text-fg-2">Publish this board to show live scenarios.</p>;
  const model = buildScenarioModel({ board, game, live });
  if (model.status === 'final') return null;
  if (!live || live.state === 'pre') return <p className="font-ui text-[15px] text-fg-2">Scenarios appear after kickoff.</p>;

  const selected = selectedPlayer
    ? model.scenarios.filter((scenario) => scenario.names.includes(selectedPlayer))
    : [];
  const secondary = selectedPlayer
    ? model.scenarios.filter((scenario) => !scenario.names.includes(selectedPlayer))
    : model.scenarios;

  const renderButton = (scenario: ViewerScenario) => (
    <button
      type="button"
      key={`${scenario.team}-${scenario.points}-${scenario.top}-${scenario.left}`}
      className="w-full min-h-11 rounded-control px-3 py-2 text-left bg-panel border border-hairline hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action transition-[background-color] duration-[var(--g-dur-state)] ease-[var(--g-ease-state)]"
      onFocus={() => onScenarioFocus({ left: scenario.left, top: scenario.top })}
      onBlur={() => onScenarioFocus(null)}
      onMouseEnter={() => onScenarioFocus({ left: scenario.left, top: scenario.top })}
      onMouseLeave={() => onScenarioFocus(null)}
      onClick={() => onScenarioFocus({ left: scenario.left, top: scenario.top })}
    >
      <span className="block font-mono tabular-nums text-[15px] text-fg">{scenario.team} {scenario.label} +{scenario.points}</span>
      <span className="block font-ui text-[14px] text-fg-2">{game.topAbbr || 'Top'} column {scenario.top} × {game.leftAbbr || 'Side'} row {scenario.left} · winner: {scenario.names.length ? scenario.names.join(', ') : 'OPEN'}</span>
    </button>
  );

  return (
    <section className="flex flex-col gap-3" role="region" aria-labelledby={titleId}>
      <h2 id={titleId} className="font-display text-[26px] leading-[1.1] text-fg">What score changes the next result?</h2>
      <p className="font-ui text-[14px] text-fg-3">Each line shows a score and whose square it lands on.</p>
      {model.status === 'last-known' && <p className="font-ui text-[14px] text-gold">{lastKnownCopy(model.lastKnownCheckedAt)}</p>}
      {selectedPlayer && selected.length > 0 && (
        <div className="flex flex-col gap-2" aria-label="Next scores that match your squares">
          {selected.map(renderButton)}
        </div>
      )}
      {selectedPlayer && selected.length === 0 && (
        <p className="font-ui text-[15px] text-fg-2">None of the next scores listed here match your squares right now.</p>
      )}
      <details className="group rounded-card border border-hairline p-3">
        <summary className="min-h-11 flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden font-ui text-[15px] text-fg">
          <span>All possible next scores</span>
          <span aria-hidden="true" className="font-mono text-fg-3 group-open:hidden">+</span>
          <span aria-hidden="true" className="font-mono text-fg-3 hidden group-open:inline">−</span>
        </summary>
        <div className="mt-3 flex flex-col gap-2">{secondary.map(renderButton)}</div>
      </details>
      <p className="font-mono text-[12px] text-fg-3">{model.disclaimer}</p>
    </section>
  );
};

export default ScenarioDisclosure;
