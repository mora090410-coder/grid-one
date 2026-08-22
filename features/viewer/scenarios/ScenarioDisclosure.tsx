import React from 'react';
import type { BoardData, GameState, LiveGameData } from '../../../types';
import { buildScenarioModel, type ViewerScenario } from './scenarioModel';

const scenarioText = (scenario: ViewerScenario) => `${scenario.team} ${scenario.label} +${scenario.points} → digits ${scenario.top}/${scenario.left}`;

export interface ScenarioDisclosureProps {
  board: BoardData;
  game: GameState;
  live: LiveGameData | null;
  selectedPlayer: string;
  servicesEnabled: boolean;
  onScenarioFocus: (coords: { left: number; top: number } | null) => void;
}

const ScenarioDisclosure: React.FC<ScenarioDisclosureProps> = ({ board, game, live, selectedPlayer, servicesEnabled, onScenarioFocus }) => {
  if (!servicesEnabled) return <p className="oa-body text-broadcast-white/70">Publish this board to show live scenarios.</p>;
  const model = buildScenarioModel({ board, game, live });
  if (model.status === 'final') return null;
  if (!live || live.state === 'pre') return <p className="oa-body text-broadcast-white/70">Scenarios appear after kickoff.</p>;

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
      className="w-full min-h-11 border border-broadcast-white/20 bg-ink/30 px-3 py-2 text-left text-broadcast-white"
      style={{ minHeight: 44 }}
      onFocus={() => onScenarioFocus({ left: scenario.left, top: scenario.top })}
      onBlur={() => onScenarioFocus(null)}
      onMouseEnter={() => onScenarioFocus({ left: scenario.left, top: scenario.top })}
      onMouseLeave={() => onScenarioFocus(null)}
      onClick={() => onScenarioFocus({ left: scenario.left, top: scenario.top })}
    >
      <span className="oa-slab block">{scenario.team} {scenario.label} +{scenario.points}</span>
      <span className="oa-body text-sm text-broadcast-white/70">digits {scenario.top}/{scenario.left} · {scenario.names.length ? scenario.names.join(', ') : 'Unassigned'}</span>
    </button>
  );

  return (
    <section className="border-t border-broadcast-white/20 py-5" aria-labelledby="viewer-scenarios-title">
      <h2 id="viewer-scenarios-title" className="oa-headline text-2xl text-broadcast-white">What score changes the next result?</h2>
      {model.status === 'last-known' && <p className="oa-body mt-2 text-sm text-gold">Using last-known score until scoring reconnects.</p>}
      {selectedPlayer && selected.length > 0 && (
        <div className="mt-4 grid gap-2" aria-label="Matching next-score outcomes">
          {selected.map(renderButton)}
        </div>
      )}
      {selectedPlayer && selected.length === 0 && (
        <p className="oa-body mt-3 text-broadcast-white/70">No standard next-score outcome currently matches the selected squares.</p>
      )}
      <details className="mt-4 border border-broadcast-white/20 p-3">
        <summary className="oa-slab min-h-11 cursor-pointer text-broadcast-white" style={{ minHeight: 44 }}>All next-score outcomes</summary>
        <div className="mt-3 grid gap-2">{secondary.map(renderButton)}</div>
      </details>
      <p className="oa-body mt-3 text-xs text-broadcast-white/60">{model.disclaimer}</p>
    </section>
  );
};

export default ScenarioDisclosure;
