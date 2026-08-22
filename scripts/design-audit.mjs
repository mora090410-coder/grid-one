#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SCAN_ROOTS = [
  'App.tsx',
  'components',
  'features',
  'hooks',
  'pages',
  'services',
  'src',
  'utils',
];

const SOURCE_EXTENSIONS = new Set(['.css', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const RAW_COLOR_TOKEN_FILES = new Set(['DESIGN.md', 'docs/DESIGN_TOKENS.md', 'src/index.css']);
const TOKEN_DEFINITION_FILES = new Set(['DESIGN.md', 'docs/DESIGN_TOKENS.md']);
const FRAMEWORK_COLOR_UTILITY = '(?:bg|text|border|ring|from|via|to|accent|decoration|placeholder|divide|outline)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\\d{2,3})?(?:/\\d+)?';
const FRAMEWORK_VARIANT = '(?:(?:[a-z][a-z0-9-]*-)?\\[[^\\]]+\\]|[a-z][a-z0-9-]*):';

const RULES = [
  {
    rule: 'raw-visual-literal',
    pattern: /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/g,
    skip: (file) => RAW_COLOR_TOKEN_FILES.has(file),
  },
  {
    rule: 'framework-default-color',
    pattern: new RegExp('(?:^|[\\s"\'`])(?:' + FRAMEWORK_VARIANT + ')*(' + FRAMEWORK_COLOR_UTILITY + ')(?=[\\s"\'`])', 'g'),
    token: (match) => match[1],
  },
  {
    rule: 'gradient-blur-glow',
    pattern: /\b(?:bg-gradient(?:-[a-z0-9]+)*|(?:linear|radial|conic)-gradient\s*\(|backdrop-blur(?:-[a-z0-9]+)?|(?<!backdrop-)blur(?:-[a-z0-9]+)?|filter:\s*blur\s*\(|[a-z0-9-]*glow[a-z0-9-]*)\b/gi,
    skip: (file) => TOKEN_DEFINITION_FILES.has(file),
  },
  {
    rule: 'arbitrary-shadow-radius',
    pattern: /\bshadow-\[[^\]]+\]|\brounded-\[[^\]]+\]|\bborder-radius\s*:(?!\s*var\(--gridone-radius-(?:control|surface|grid)\))/g,
  },
  {
    rule: 'forbidden-glass-glow-alias',
    pattern: /\b(?:[a-z0-9-]*glass[a-z0-9-]*|[a-z0-9-]*glow[a-z0-9-]*)\b/gi,
    skip: (file) => TOKEN_DEFINITION_FILES.has(file),
  },
];

const extensionOf = (file) => {
  const match = /\.[^.]+$/.exec(file);
  return match ? match[0] : '';
};

const isInsideRoot = (root, candidate) => {
  const relativePath = relative(root, candidate);
  return relativePath === '' || (relativePath !== '..' && !relativePath.startsWith(`..${sep}`));
};

const assertInsideRoot = (root, candidate, label) => {
  if (!isInsideRoot(root, candidate)) throw new Error(`${label} resolves outside audit root`);
};

const walk = (root, rootRealPath, entry, files) => {
  const absolute = join(root, entry);
  if (!existsSync(absolute)) return;
  assertInsideRoot(root, resolve(root, entry), `Scan candidate ${JSON.stringify(entry)}`);
  const stats = lstatSync(absolute);
  if (stats.isSymbolicLink()) return;
  assertInsideRoot(rootRealPath, realpathSync(absolute), `Scan candidate ${JSON.stringify(entry)}`);
  if (stats.isDirectory()) {
    for (const child of readdirSync(absolute).sort()) {
      if (child === 'node_modules' || child === 'dist' || child === '.git' || child === '.impeccable') continue;
      walk(root, rootRealPath, join(entry, child), files);
    }
    return;
  }
  if (stats.isFile() && SOURCE_EXTENSIONS.has(extensionOf(entry))) files.push(entry.split(sep).join('/'));
};

export const collectDefaultFiles = (root = process.cwd()) => {
  const normalizedRoot = resolve(root);
  const rootRealPath = realpathSync(normalizedRoot);
  const files = [];
  for (const entry of DEFAULT_SCAN_ROOTS) walk(normalizedRoot, rootRealPath, entry, files);
  return [...new Set(files)].sort();
};

const lineAndColumnFor = (source, index) => {
  const prefix = source.slice(0, index);
  const lines = prefix.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
};

const stripComments = (source) => {
  let output = '';
  let state = 'code';

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === 'line-comment') {
      if (char === '\n') {
        output += char;
        state = 'code';
      } else {
        output += ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        output += '  ';
        index += 1;
        state = 'code';
      } else {
        output += char === '\n' ? '\n' : ' ';
      }
      continue;
    }

    output += char;

    if (char === '\\') {
      if (next !== undefined) {
        output += next;
        index += 1;
      }
      continue;
    }

    if (state === 'single') {
      if (char === "'") state = 'code';
      continue;
    }

    if (state === 'double') {
      if (char === '"') state = 'code';
      continue;
    }

    if (state === 'template') {
      if (char === '`') state = 'code';
      continue;
    }

    if (char === "'") {
      state = 'single';
    } else if (char === '"') {
      state = 'double';
    } else if (char === '`') {
      state = 'template';
    } else if (char === '/' && next === '/' && !/[a-z][a-z0-9+.-]*:$/i.test(output.slice(0, -1))) {
      output = `${output.slice(0, -1)}  `;
      index += 1;
      state = 'line-comment';
    } else if (char === '/' && next === '*') {
      output = `${output.slice(0, -1)}  `;
      index += 1;
      state = 'block-comment';
    }
  }

  return output;
};

const scanFile = (root, file) => {
  const source = readFileSync(join(root, file), 'utf8');
  const scannedSource = stripComments(source);
  const violations = [];
  for (const rule of RULES) {
    if (rule.skip?.(file)) continue;
    rule.pattern.lastIndex = 0;
    for (const match of scannedSource.matchAll(rule.pattern)) {
      const token = rule.token ? rule.token(match) : match[0].trim();
      const tokenOffset = match[0].indexOf(token);
      const location = lineAndColumnFor(source, (match.index ?? 0) + Math.max(tokenOffset, 0));
      violations.push({
        rule: rule.rule,
        file,
        line: location.line,
        column: location.column,
        match: token,
      });
    }
  }
  return violations;
};

export const auditFiles = ({ root = process.cwd(), files = collectDefaultFiles(root) } = {}) => {
  const normalizedRoot = resolve(root);
  const rootRealPath = realpathSync(normalizedRoot);
  const normalizedFiles = files.map((file) => {
    const resolvedCandidate = resolve(normalizedRoot, file);
    assertInsideRoot(normalizedRoot, resolvedCandidate, `Scan candidate ${JSON.stringify(file)}`);
    if (!existsSync(resolvedCandidate)) throw new Error(`Scan candidate ${JSON.stringify(file)} does not exist`);
    assertInsideRoot(rootRealPath, realpathSync(resolvedCandidate), `Scan candidate ${JSON.stringify(file)}`);
    return relative(normalizedRoot, resolvedCandidate).split(sep).join('/');
  }).sort();
  const violations = normalizedFiles.flatMap((file) => scanFile(normalizedRoot, file));
  return { ok: violations.length === 0, violations };
};

const formatViolation = (violation) => (
  `${violation.file}:${violation.line}:${violation.column} ${violation.rule} ${JSON.stringify(violation.match)}`
);

export const formatAuditResult = (result) => {
  if (result.ok) return 'Design audit passed: 0 violations';
  return [
    `Design audit failed: ${result.violations.length} violation${result.violations.length === 1 ? '' : 's'}`,
    ...result.violations.map(formatViolation),
  ].join('\n');
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const result = auditFiles();
  console.log(formatAuditResult(result));
  process.exitCode = result.ok ? 0 : 1;
}
