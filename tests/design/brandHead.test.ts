import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_OG_IMAGE, SITE_URL } from '../../seo/publicRouteMetadata';
import { renderSeoBlock } from '../../build/staticSeoPages';
import { PUBLIC_ROUTE_METADATA } from '../../seo/publicRouteMetadata';

/*
 * Corner Square rebrand, head tags. Every icon the head or the web manifest
 * names must ship from public/, and nothing from the retired icon set may.
 */
const html = readFileSync('index.html', 'utf8');
const manifest = JSON.parse(readFileSync('public/site.webmanifest', 'utf8')) as {
  theme_color: string;
  background_color: string;
  icons: Array<{ src: string; sizes: string; type: string }>;
};
const head = new DOMParser().parseFromString(html, 'text/html').head;

function pngSize(path: string) {
  const png = readFileSync(path);
  expect(png.subarray(1, 4).toString('ascii'), path).toBe('PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('brand head tags', () => {
  it('links the Corner Square favicons and touch icon, and every one ships', () => {
    const icons = [...head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')]
      .map((link) => `${link.getAttribute('rel')} ${link.getAttribute('type') ?? ''} ${link.getAttribute('sizes') ?? ''} ${link.getAttribute('href')}`.replace(/\s+/g, ' '));
    expect(icons).toEqual([
      'icon any /favicon.ico',
      'icon image/svg+xml /favicon.svg',
      'icon image/png 32x32 /favicon-32.png',
      'icon image/png 16x16 /favicon-16.png',
      'apple-touch-icon 180x180 /apple-touch-icon.png',
    ]);
    for (const file of ['favicon.ico', 'favicon.svg', 'favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png']) {
      expect(existsSync(`public/${file}`), file).toBe(true);
    }
    expect(pngSize('public/favicon-32.png')).toEqual({ width: 32, height: 32 });
    expect(pngSize('public/favicon-16.png')).toEqual({ width: 16, height: 16 });
    expect(pngSize('public/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
  });

  it('paints the browser chrome in brand ink', () => {
    expect(head.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#13212E');
    expect(manifest.theme_color).toBe('#13212E');
    expect(manifest.background_color).toBe('#13212E');
  });

  it('lists the 192 and 512 app icons in the web manifest', () => {
    expect(manifest.icons).toEqual([
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ]);
    expect(pngSize('public/icon-192.png')).toEqual({ width: 192, height: 192 });
    expect(pngSize('public/icon-512.png')).toEqual({ width: 512, height: 512 });
  });

  it('shares the 1200 by 630 Corner Square card on Open Graph and Twitter', () => {
    expect(DEFAULT_OG_IMAGE).toBe(`${SITE_URL}/og-image.png`);
    expect(pngSize('public/og-image.png')).toEqual({ width: 1200, height: 630 });
    const blocks = [html, ...PUBLIC_ROUTE_METADATA.map(renderSeoBlock)];
    for (const block of blocks) {
      const doc = new DOMParser().parseFromString(`<html><head>${block}</head></html>`, 'text/html');
      expect(doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('GridOne');
      expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(DEFAULT_OG_IMAGE);
      expect(doc.querySelector('meta[property="og:image:width"]')?.getAttribute('content')).toBe('1200');
      expect(doc.querySelector('meta[property="og:image:height"]')?.getAttribute('content')).toBe('630');
      expect(doc.querySelector('meta[name="twitter:card"], meta[property="twitter:card"]')?.getAttribute('content')).toBe('summary_large_image');
      expect(doc.querySelector('meta[name="twitter:image"], meta[property="twitter:image"]')?.getAttribute('content')).toBe(DEFAULT_OG_IMAGE);
    }
  });

  it('ships nothing from the retired icon and share-image set', () => {
    for (const old of ['public/icons/gridone-icon-256.png', 'public/icons/gridone-icon-512.png', 'public/og-image.jpg']) {
      expect(existsSync(old), old).toBe(false);
    }
  });
});
