import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditFiles, collectDefaultFiles } from '../scripts/design-audit.mjs';

const runFixture = (relativePath: string, source: string) => {
  const root = mkdtempSync(join(tmpdir(), 'gridone-design-audit-'));
  const fullPath = join(root, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, source);
  return auditFiles({ root, files: [relativePath] });
};

describe('deterministic design audit', () => {
  it('fails raw visual color literals outside approved token sources', () => {
    const result = runFixture('components/Violation.tsx', 'export const Bad = () => <div className="text-[#8F1D2C]" style={{ color: "rgb(255, 255, 255)", borderColor: "hsl(0 0% 0%)" }} />;');

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining(['raw-visual-literal']),
    );
  });

  it('allows raw canonical values in approved token sources only', () => {
    const result = runFixture('DESIGN.md', 'colors:\n  primary: "#8F1D2C"\n  live: "#22C55E"\n');

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('fails framework default color utilities in production components', () => {
    const result = runFixture('components/Violation.tsx', 'export const Bad = () => <section className="bg-white text-gray-700 border-neutral-200 ring-emerald-500" />;');

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining(['framework-default-color']),
    );
  });

  it('fails gradient, blur, and glow usage', () => {
    const result = runFixture('pages/Violation.tsx', 'export const Bad = () => <div className="bg-gradient-to-r from-cardinal to-gold backdrop-blur-sm shadow-[0_0_30px_var(--color-gold-glow)]" />;');

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining(['gradient-blur-glow']),
    );
  });

  it('fails arbitrary shadow and radius utilities', () => {
    const result = runFixture('src/Violation.tsx', 'export const Bad = () => <div className="shadow-[0_12px_40px_rgba(0,0,0,.4)] rounded-[19px]" />;');

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining(['arbitrary-shadow-radius']),
    );
  });

  it('allows canonical GridOne radius variables', () => {
    const result = runFixture(
      'src/Allowed.css',
      '.control { border-radius: var(--gridone-radius-control); }\n.surface { border-radius: var(--gridone-radius-surface); }',
    );

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('ignores forbidden words and visual literals inside comments', () => {
    const result = runFixture(
      'components/Allowed.tsx',
      '// Never use glow or #FFFFFF here.\nexport const Allowed = () => <div className="bg-cardinal" />;\n/* backdrop-blur-sm is prohibited */',
    );

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('fails forbidden glass and glow alias consumption outside token definition files', () => {
    const result = runFixture('components/Violation.tsx', 'export const Bad = () => <div className="bg-surface-glass text-gold-glow" style={{ background: "var(--gridone-color-surface-glass)" }} />;');

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining(['forbidden-glass-glow-alias']),
    );
  });

  it('rejects parent-relative and absolute file candidates that resolve outside the audit root', () => {
    const root = mkdtempSync(join(tmpdir(), 'gridone-design-audit-root-'));
    const outside = mkdtempSync(join(tmpdir(), 'gridone-design-audit-outside-'));
    const outsideFile = join(outside, 'Outside.tsx');
    writeFileSync(outsideFile, 'export const Outside = () => <div className="text-gray-700" />;');

    expect(() => auditFiles({ root, files: ['../Outside.tsx'] })).toThrow(/outside audit root/i);
    expect(() => auditFiles({ root, files: [outsideFile] })).toThrow(/outside audit root/i);
  });

  it('default collection skips file and directory symlinks, including loops and outside targets', () => {
    const root = mkdtempSync(join(tmpdir(), 'gridone-design-audit-symlink-'));
    mkdirSync(join(root, 'components'), { recursive: true });
    mkdirSync(join(root, 'outside'), { recursive: true });
    writeFileSync(join(root, 'components', 'Real.tsx'), 'export const Real = () => <div />;');
    writeFileSync(join(root, 'outside', 'Outside.tsx'), 'export const Outside = () => <div className="text-gray-700" />;');
    symlinkSync(join(root, 'components'), join(root, 'components', 'loop'), 'dir');
    symlinkSync(join(root, 'outside'), join(root, 'components', 'outside-dir'), 'dir');
    symlinkSync(join(root, 'outside', 'Outside.tsx'), join(root, 'components', 'outside-file.tsx'), 'file');

    expect(collectDefaultFiles(root)).toEqual(['components/Real.tsx']);
    expect(auditFiles({ root }).violations.map((violation) => violation.file)).toEqual([]);
  });

  it('preserves comment-like text inside strings and https URLs while ignoring real comments with line positions intact', () => {
    const result = runFixture(
      'components/Comments.tsx',
      [
        '// text-gray-700 #FFFFFF glow must be ignored',
        'const single = \'https://example.com/path text-gray-700\';',
        'const double = "literal // #ABCDEF stays scannable";',
        'const template = `literal /* rgba(1, 2, 3, 0.4) */ stays scannable`;',
        '/* bg-white must be ignored */',
      ].join('\n'),
    );

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'framework-default-color', line: 2, match: 'text-gray-700' }),
        expect.objectContaining({ rule: 'raw-visual-literal', line: 3, match: '#ABCDEF' }),
        expect.objectContaining({ rule: 'raw-visual-literal', line: 4, match: 'rgba(' }),
      ]),
    );
    expect(result.violations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 1 }),
        expect.objectContaining({ line: 5 }),
      ]),
    );
  });

  it('detects framework color utilities behind variant chains and reports the utility token column only', () => {
    const source = 'export const Bad = () => <div className="hover:focus:md:dark:group-hover:disabled:text-gray-700" />;';
    const result = runFixture('components/Variants.tsx', source);
    const utilityColumn = source.indexOf('text-gray-700') + 1;

    expect(result.violations).toEqual([
      expect.objectContaining({
        rule: 'framework-default-color',
        line: 1,
        column: utilityColumn,
        match: 'text-gray-700',
      }),
    ]);
  });

  it('detects framework colors behind prefixed arbitrary Tailwind variants', () => {
    const source = 'export const Bad = () => <div className="data-[state=open]:text-gray-700 group-data-[state=open]:bg-white peer-aria-[expanded=true]:border-neutral-200" />;';
    const result = runFixture('components/ArbitraryVariants.tsx', source);

    expect(result.violations.map((violation) => violation.match)).toEqual([
      'text-gray-700',
      'bg-white',
      'border-neutral-200',
    ]);
  });

  it('preserves unquoted CSS URLs without hiding later same-line violations', () => {
    const source = '.hero { background-image: url(https://cdn.example/a.svg); color: #FFFFFF; }';
    const result = runFixture('components/Urls.css', source);

    expect(result.violations).toEqual([
      expect.objectContaining({ rule: 'raw-visual-literal', match: '#FFFFFF' }),
    ]);
  });

  it('returns violations in deterministic file and output order regardless of candidate ordering', () => {
    const root = mkdtempSync(join(tmpdir(), 'gridone-design-audit-order-'));
    const files = ['components/B.tsx', 'components/A.tsx'];
    for (const file of files) {
      const fullPath = join(root, file);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, `export const Bad = () => <div className="text-gray-700" style={{ color: "#FFFFFF" }} />;`);
    }

    const result = auditFiles({ root, files });

    expect(result.violations.map((violation) => `${violation.file}:${violation.rule}:${violation.match}`)).toEqual([
      'components/A.tsx:raw-visual-literal:#FFFFFF',
      'components/A.tsx:framework-default-color:text-gray-700',
      'components/B.tsx:raw-visual-literal:#FFFFFF',
      'components/B.tsx:framework-default-color:text-gray-700',
    ]);
  });
});
