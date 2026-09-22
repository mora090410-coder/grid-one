import React, { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from './motion';

/** Place-value comparison from the right, so 9 → 10 rolls both new digits and 21 → 22 rolls only the ones. */
export function changedDigitFlags(previous: string, next: string): boolean[] {
  if (previous === next) return [...next].map(() => false);
  const prev = [...previous];
  const curr = [...next];
  const shift = curr.length - prev.length;
  return curr.map((char, index) => prev[index - shift] !== char);
}

interface DigitFlowProps {
  value: string | number;
  className?: string;
}

/**
 * Odometer-style roll for the characters that changed. The first paint is
 * still, and reduced motion swaps the glyphs with no animation.
 */
export function DigitFlow({ value, className = '' }: DigitFlowProps) {
  const text = String(value);
  const reduced = useReducedMotion();
  const previous = useRef(text);
  const [generation, setGeneration] = useState(0);
  const [changed, setChanged] = useState<boolean[]>(() => [...text].map(() => false));

  useLayoutEffect(() => {
    if (previous.current === text) return;
    const prior = previous.current;
    previous.current = text;
    setChanged(reduced ? [...text].map(() => false) : changedDigitFlags(prior, text));
    setGeneration((current) => current + 1);
  }, [reduced, text]);

  const rolling = changed.some(Boolean);
  if (!rolling) return <span className={className || undefined}>{text}</span>;

  return (
    <span className={`inline-flex ${className}`.trim()}>
      {[...text].map((char, index) => (
        <span
          key={changed[index] ? `${index}-${generation}` : `${index}-still`}
          className={changed[index] ? 'digit-flow' : undefined}
        >
          {char}
        </span>
      ))}
    </span>
  );
}
