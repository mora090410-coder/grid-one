import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { installOrganizerSession, installOrganizerSupport } from './helpers/organizerMocks';

// Run against the production build with PLAYWRIGHT_BUILT_UI=1. The default
// destination respects the isolated checkout; a parent reviewer can override it.
const evidence = resolve(process.env.GRIDONE_EVIDENCE_DIR || 'evidence/rebuild-2026-11-05');

for (const width of [1440, 320]) {
  test(`marketing text stays opaque through scroll entry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('/');
    // Sample every animation frame, including pending, delayed and entering
    // reveals. Do not settle animations before checking the failing policy.
    const failures = await page.evaluate(async () => {
      const failures = new Set<string>();
      const inspect = () => {
        for (const element of document.querySelectorAll<HTMLElement>('main [data-reveal], .sample-stage-copy, .sample-detail')) {
          if (!element.textContent?.trim()) continue;
          if (element.dataset.reveal === 'pending') failures.add(`${element.className}: pending fade`);
          for (let node: HTMLElement | null = element; node; node = node.parentElement) {
            if (getComputedStyle(node).opacity !== '1') failures.add(`${element.className}: opacity on ${node.className}`);
          }
        }
      };
      inspect();
      for (const element of document.querySelectorAll<HTMLElement>('main [data-reveal]')) {
        element.scrollIntoView({ block: 'center', behavior: 'instant' });
        const start = performance.now();
        do {
          await new Promise(requestAnimationFrame);
          inspect();
        } while (performance.now() - start < 450);
      }
      return [...failures];
    });
    expect(failures).toEqual([]);
  });
}

for (const width of [1440, 390, 320]) {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`rebuild evidence at ${width}px, motion ${reducedMotion}`, async ({ page }, testInfo) => {
      await mkdir(evidence, { recursive: true });
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion });
      // No request may reach an external service. Later local API mocks take
      // precedence; any missing local mock aborts instead of reaching a service.
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname !== '127.0.0.1' || url.pathname.startsWith('/api/')) return route.abort();
        return route.continue();
      });
      await installOrganizerSupport(page);
      const capture = async (name: string) => {
        await page.evaluate(async () => {
          await document.fonts.ready;
          const height = document.body.scrollHeight;
          for (let offset = 0; offset < height; offset += innerHeight) {
            scrollTo(0, offset);
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          }
          scrollTo(0, 0);
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        await testInfo.attach(`${name}-axe`, { body: JSON.stringify(result.violations), contentType: 'application/json' });
        expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
        await page.screenshot({ path: resolve(evidence, `${name}-${width}-${reducedMotion}.png`), fullPage: true, animations: 'disabled' });
      };
      await page.goto('/');
      const sample = page.getByRole('region', { name: 'Interactive sample board' });
      await expect(sample.getByRole('gridcell')).toHaveCount(100);
      await capture('home-setup');
      for (const stage of ['Share', 'Game day']) {
        await sample.getByRole('button', { name: stage, exact: true }).click();
        await capture(`home-${stage.toLowerCase().replace(' ', '-')}`);
      }
      for (const control of ['Previous square', 'Next square']) {
        const box = await sample.getByRole('button', { name: control }).boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
      if (reducedMotion === 'reduce') {
        expect(await sample.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
      }
      await page.goto('/create');
      await page.getByLabel('Board name', { exact: true }).fill('Parkside families · Week one');
      await page.getByRole('radio').first().click();
      await expect(page.getByRole('status', { name: 'Setup progress' })).toHaveText('Ready to save your private draft');
      await capture('create');
      await page.reload();
      await expect(page.getByLabel('Board name', { exact: true })).toHaveValue('Parkside families · Week one');
      await page.goto('/demo');
      await expect(page.getByText('Sample board — not a live game', { exact: true })).toBeVisible();
      await capture('demo');
      await installOrganizerSession(page);
      await page.route('**/rest/v1/contests*', route => route.fulfill({ json: [] }));
      await page.goto('/dashboard');
      await expect(page.getByText('No boards yet.')).toBeVisible();
      await capture('dashboard-empty');
      if (width === 320) {
        await page.goto('/');
        await expect(page.getByTestId('homepage-first-viewport')).toBeVisible();
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        await capture('home-text-200');
      }
    });
  }
}
