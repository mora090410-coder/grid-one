import React, { useId } from 'react';

/** Decorative board-sized channels. Fixed CSS-pixel tiles; never an interactive grid. */
export default function GlassGridBackground() {
  const prefix = useId().replace(/:/g, '');
  return <>{[false, true].map(phone => {
    const id = `${prefix}-${phone ? 'phone' : 'desktop'}`;
    const tile = phone ? 230 : 440, gap = phone ? 16 : 32, radius = phone ? 40 : 64;
    const x = phone ? -60 : -120, y = phone ? -90 : -150;
    return <svg key={id} data-g1-grid={phone ? 'phone' : 'desktop'} aria-hidden="true" focusable="false" className="g1-grid-background" width="100%" height="100%">
      <defs>
        <linearGradient id={`${id}-channel`} x2="1" y2="1"><stop stopColor="var(--g1-channel-a)"/><stop offset="1" stopColor="var(--g1-channel-b)"/></linearGradient>
        <linearGradient id={`${id}-rim`} x2="1" y2="1"><stop stopColor="var(--g1-gold-hi)" stopOpacity=".7"/><stop offset=".35" stopColor="var(--g1-chalk)" stopOpacity=".08"/><stop offset=".7" stopColor="var(--g1-chalk)" stopOpacity=".03"/><stop offset="1" stopColor="var(--g1-gold)" stopOpacity=".3"/></linearGradient>
        <pattern id={`${id}-holes`} x={x} y={y} width={tile+gap} height={tile+gap} patternUnits="userSpaceOnUse"><rect width={tile} height={tile} rx={radius} fill="black"/></pattern>
        <pattern id={`${id}-edges`} x={x} y={y} width={tile+gap} height={tile+gap} patternUnits="userSpaceOnUse"><rect width={tile} height={tile} rx={radius} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.5"/></pattern>
        <pattern id={`${id}-soft-edges`} x={x} y={y} width={tile+gap} height={tile+gap} patternUnits="userSpaceOnUse"><rect width={tile} height={tile} rx={radius} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="5"/></pattern>
        <mask id={`${id}-mask`}><rect width="100%" height="100%" fill="white"/><rect width="100%" height="100%" fill={`url(#${id}-holes)`}/></mask>
        <filter id={`${id}-blur`}><feGaussianBlur stdDeviation={phone ? 4 : 6}/></filter>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-channel)`} opacity=".5" mask={`url(#${id}-mask)`}/>
      <rect width="100%" height="100%" fill={`url(#${id}-soft-edges)`} opacity=".5" filter={`url(#${id}-blur)`}/>
      <rect width="100%" height="100%" fill={`url(#${id}-edges)`}/>
    </svg>;
  })}</>;
}
