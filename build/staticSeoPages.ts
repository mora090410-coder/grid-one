import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  DEFAULT_OG_IMAGE,
  PUBLIC_ROUTE_METADATA,
  SITE_NAME,
  SITE_URL,
  type PublicRouteMetadata,
} from '../seo/publicRouteMetadata';

export const SEO_BLOCK_START = '<!-- gridone:seo:start -->';
export const SEO_BLOCK_END = '<!-- gridone:seo:end -->';

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const jsonForHtml = (value: unknown) => JSON.stringify(value)
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e')
  .replaceAll('&', '\\u0026');

export const renderSeoBlock = (route: PublicRouteMetadata): string => {
  const canonicalUrl = new URL(route.path, `${SITE_URL}/`).toString();
  const robots = route.noIndex ? 'noindex, nofollow' : 'index, follow';
  const graph = Array.isArray(route.schema) ? route.schema : [route.schema];

  return `${SEO_BLOCK_START}
    <title>${escapeHtml(route.title)}</title>
    <meta name="description" content="${escapeHtml(route.description)}">
    <meta name="robots" content="${robots}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <meta property="og:type" content="${route.type}">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <meta property="og:title" content="${escapeHtml(route.title)}">
    <meta property="og:description" content="${escapeHtml(route.description)}">
    <meta property="og:image" content="${DEFAULT_OG_IMAGE}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}">
    <meta name="twitter:title" content="${escapeHtml(route.title)}">
    <meta name="twitter:description" content="${escapeHtml(route.description)}">
    <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">
    <script type="application/ld+json" data-gridone-schema="page">${jsonForHtml({
      '@context': 'https://schema.org',
      '@graph': graph,
    })}</script>
    ${SEO_BLOCK_END}`;
};

export const renderStaticRouteHtml = (
  template: string,
  route: PublicRouteMetadata,
): string => {
  const start = template.indexOf(SEO_BLOCK_START);
  const end = template.indexOf(SEO_BLOCK_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('The HTML template is missing the GridOne SEO block markers.');
  }

  return [
    template.slice(0, start),
    renderSeoBlock(route),
    template.slice(end + SEO_BLOCK_END.length),
  ].join('');
};

export const outputPathForRoute = (outDir: string, routePath: string): string => (
  routePath === '/'
    ? join(outDir, 'index.html')
    : join(outDir, `${routePath.slice(1)}.html`)
);

export const trailingSlashOutputPathForRoute = (
  outDir: string,
  routePath: string,
): string => (
  routePath === '/'
    ? join(outDir, 'index.html')
    : join(outDir, routePath.slice(1), 'index.html')
);

export const generateStaticSeoPages = async (outDir: string): Promise<void> => {
  const templatePath = join(outDir, 'index.html');
  const template = await readFile(templatePath, 'utf8');

  await Promise.all(PUBLIC_ROUTE_METADATA.map(async (route) => {
    const renderedHtml = renderStaticRouteHtml(template, route);
    const outputPaths = new Set([
      outputPathForRoute(outDir, route.path),
      trailingSlashOutputPathForRoute(outDir, route.path),
    ]);

    await Promise.all(Array.from(outputPaths, async (outputPath) => {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, renderedHtml, 'utf8');
    }));
  }));
};
