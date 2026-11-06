import React from 'react';
export type BoardMapState = 'neutral' | 'seller' | 'taken' | 'picked' | 'mine' | 'live';
/** A labelled, noninteractive overview. Never a tiny claim surface. */
export default function BoardMap({label, states}:{label:string;states:ReadonlyMap<number,BoardMapState>}) {
 return <div role="img" aria-label={label} className="g1-board-map">{Array.from({length:100},(_,index)=><span key={index} aria-hidden="true" data-g1-map-state={states.get(index) ?? 'neutral'}/>)}</div>;
}
