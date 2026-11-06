import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps translucent glass text readable even over the brightest permitted rim', () => {
  const css = readFileSync('src/design/liquid/materials.css', 'utf8');
  const alpha = Number(css.match(/--g1-glass-backing-alpha:\s*([.\d]+)/)?.[1] ?? 0);
  expect(alpha).toBeGreaterThanOrEqual(.94);
  // Conservative bound: full white behind the dark backplane, then 7.5% white fill.
  const background = [7,11,20].map(c => .075 * 255 + .925 * (c * alpha + 255 * (1-alpha)));
  const luminance = (rgb:number[]) => rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const ratio=(luminance([169,180,198])+.05)/(luminance(background)+.05);
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  expect(css).toContain('var(--g1-glass-backing-alpha)');
  expect(readFileSync('src/design/liquid/cells.css','utf8')).toContain('var(--g1-glass-backing)');
});
