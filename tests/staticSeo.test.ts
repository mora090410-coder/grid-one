import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  generateStaticSeoPages,
  outputPathForRoute,
} from '../build/staticSeoPages';
import {
  DEFAULT_OG_IMAGE,
  INDEXABLE_PUBLIC_ROUTE_METADATA,
  PUBLIC_ROUTE_METADATA,
  SITE_URL,
} from '../seo/publicRouteMetadata';

const projectRoot = process.cwd();
let outputDirectory = '';

const publicAppPaths = (): string[] => {
  const appSource = readFileSync(resolve(projectRoot, 'App.tsx'), 'utf8');
  const literalRoutePaths = Array.from(
    appSource.matchAll(/<Route\s+path="([^"]+)"/g),
    (match) => match[1],
  );
  const protectedPaths = new Set(['/boards/:boardId', '/dashboard', '/create']);

  return literalRoutePaths.filter((path) => (
    path !== '*'
    && !path.includes(':')
    && !protectedPaths.has(path)
  ));
};

const sitemapPaths = (): string[] => {
  const sitemap = readFileSync(resolve(projectRoot, 'public/sitemap.xml'), 'utf8');
  return Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => (
    new URL(match[1]).pathname
  ));
};

const filesUnder = (directory: string): string[] => (
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  })
);

const jpegDimensions = (contents: Buffer): { width: number; height: number } => {
  let offset = 2;
  while (offset + 8 < contents.length) {
    if (contents[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = contents[offset + 1];
    const segmentLength = contents.readUInt16BE(offset + 2);
    const isStartOfFrame = (
      marker >= 0xc0
      && marker <= 0xcf
      && ![0xc4, 0xc8, 0xcc].includes(marker)
    );
    if (isStartOfFrame) {
      return {
        height: contents.readUInt16BE(offset + 5),
        width: contents.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  throw new Error('JPEG dimensions were not found.');
};

beforeAll(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), 'gridone-static-seo-'));
  const htmlTemplate = await readFile(resolve(projectRoot, 'index.html'), 'utf8');
  await writeFile(join(outputDirectory, 'index.html'), htmlTemplate, 'utf8');
  await generateStaticSeoPages(outputDirectory);
});

afterAll(async () => {
  if (outputDirectory) {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

describe('build-time public route metadata', () => {
  it('keeps every static public app route in the metadata manifest', () => {
    expect(PUBLIC_ROUTE_METADATA.map((route) => route.path).sort()).toEqual(
      publicAppPaths().sort(),
    );
  });

  it('keeps the sitemap exactly aligned with indexable public routes', () => {
    expect(sitemapPaths().sort()).toEqual(
      INDEXABLE_PUBLIC_ROUTE_METADATA.map((route) => route.path).sort(),
    );
  });

  it('writes crawler-visible route-specific metadata to every direct HTML path', async () => {
    for (const route of PUBLIC_ROUTE_METADATA) {
      const html = await readFile(
        outputPathForRoute(outputDirectory, route.path),
        'utf8',
      );
      const document = new DOMParser().parseFromString(html, 'text/html');
      const canonicalUrl = new URL(route.path, `${SITE_URL}/`).toString();

      expect(document.title, route.path).toBe(route.title);
      expect(
        document.querySelector('meta[name="description"]')?.getAttribute('content'),
        route.path,
      ).toBe(route.description);
      expect(
        document.querySelector('meta[name="robots"]')?.getAttribute('content'),
        route.path,
      ).toBe(route.noIndex ? 'noindex, nofollow' : 'index, follow');
      expect(
        document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        route.path,
      ).toBe(canonicalUrl);
      expect(
        document.querySelector('meta[property="og:url"]')?.getAttribute('content'),
        route.path,
      ).toBe(canonicalUrl);
      expect(
        document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
        route.path,
      ).toBe(DEFAULT_OG_IMAGE);

      const schema = JSON.parse(
        document.querySelector('script[data-gridone-schema="page"]')?.textContent ?? '',
      ) as { '@graph': Array<{ '@type'?: string }> };
      expect(schema['@graph'].length, route.path).toBeGreaterThan(0);
      if (route.type === 'article') {
        expect(schema['@graph'].some((entry) => entry['@type'] === 'Article'), route.path)
          .toBe(true);
      }
    }
  });

  it('publishes a valid robots sitemap declaration and a 1200 by 630 OG image', () => {
    const robots = readFileSync(resolve(projectRoot, 'public/robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);

    const image = readFileSync(resolve(projectRoot, 'public/og-image.jpg'));
    expect(jpegDimensions(image)).toEqual({ width: 1200, height: 630 });
  });

  it('contains no truncated how-to article route references', () => {
    const sourceFiles = [
      ...filesUnder(resolve(projectRoot, 'pages')),
      ...filesUnder(resolve(projectRoot, 'components')),
    ].filter((path) => /\.(ts|tsx)$/.test(path));

    const truncatedReferences = sourceFiles.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return /['"]\/articles\/how-['"]/.test(source) ? [path] : [];
    });
    expect(truncatedReferences).toEqual([]);
  });
});
