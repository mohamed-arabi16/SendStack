/**
 * Test 4: Settings Persistence
 *
 * Opens the options page, changes the delay preset to "fast", saves, then
 * reloads the options page and verifies the setting was persisted.
 */

import { test, expect, clearStorage } from './fixtures';

test.describe('Settings persistence', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorage(context);
  });

  test('delay preset survives an options-page reload', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.waitForSelector('#root > div', { timeout: 10000 });

    // Change delay preset to 'fast'
    await page.selectOption('select[id="delayPreset"], select', 'fast');

    // Save settings
    await page.getByRole('button', { name: /save/i }).click();

    // Reload the options page
    await page.reload();
    await page.waitForSelector('#root > div', { timeout: 10000 });

    // The select should still show 'fast'
    const value = await page.locator('select').first().inputValue();
    expect(value).toBe('fast');
  });
});
