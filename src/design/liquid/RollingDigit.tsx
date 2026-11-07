import React, { useLayoutEffect, useRef } from 'react';

/** Only axis reveal uses this roll; clocks and assistive text never cycle digits. */
export function RollingDigit({ value, index = 0 }: { value: number | null | undefined; index?: number }) {
  const strip = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = strip.current;
    if (!node) return;
    const row = value == null ? 0 : value + 1;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { node.style.setProperty('--row', `${row}`); return; }
    const frame = requestAnimationFrame(() => node.style.setProperty('--row', `${row}`));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className="g1-roll"><span className="sr-only">{value ?? '·'}</span><span ref={strip} aria-hidden="true" className="g1-roll-strip" style={{ '--i': index } as React.CSSProperties}>{['·',0,1,2,3,4,5,6,7,8,9].map(digit => <span key={digit}>{digit}</span>)}</span></span>;
}
