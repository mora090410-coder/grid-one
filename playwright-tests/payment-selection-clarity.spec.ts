import { expect, test, type Locator } from '@playwright/test';
import { boardId, installOrganizerBoard } from './helpers/organizerMocks';

async function verifyVisibleSelection(group: Locator) {
  for (const name of ['Not asked yet', 'Unpaid', 'Paid']) {
    const selected = group.getByRole('radio', { name, exact: true });
    await selected.click();
    await expect(selected).toBeChecked();
    await expect(group.locator('[aria-checked="true"]')).toHaveCount(1);
    const states = await group.getByRole('radio').evaluateAll(radios => radios.map(radio => {
      const style = getComputedStyle(radio);
      const box = radio.getBoundingClientRect();
      return { checked: radio.getAttribute('aria-checked') === 'true', tabIndex: (radio as HTMLElement).tabIndex, background: style.backgroundColor, border: style.borderColor, width: box.width, height: box.height };
    }));
    const active = states.find(state => state.checked)!;
    for (const inactive of states.filter(state => !state.checked)) {
      expect(active.background !== inactive.background || active.border !== inactive.border,
        `${name} must look selected, not just expose aria-checked`).toBe(true);
    }
    for (const state of states) {
      expect(state.tabIndex, 'A radio group has one Tab stop; arrows move within it').toBe(state.checked ? 0 : -1);
      expect(state.width).toBeGreaterThanOrEqual(44);
      expect(state.height).toBeGreaterThanOrEqual(44);
    }
  }
}

for (const width of [320, 390, 1440]) {
  test(`private payment choices have an unmistakable selected state at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await installOrganizerBoard(page);
    await page.goto(`/boards/${boardId}`);
    await page.getByRole('button', { name: /^Square 1,/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Square 1', exact: true });
    await verifyVisibleSelection(sheet.getByRole('radiogroup', { name: 'Payment', exact: true }));
    await info.attach('square-payment-selection', { body: await page.screenshot(), contentType: 'image/png' });
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await page.getByRole('button', { name: 'Select squares', exact: true }).click();
    await page.getByRole('button', { name: /^Square 1,/ }).click();
    const assignment = page.getByRole('group', { name: 'Assign selected squares', exact: true });
    await verifyVisibleSelection(assignment.getByRole('radiogroup', { name: 'Payment', exact: true }));
    await info.attach('allocation-payment-selection', { body: await page.screenshot(), contentType: 'image/png' });
  });
}
