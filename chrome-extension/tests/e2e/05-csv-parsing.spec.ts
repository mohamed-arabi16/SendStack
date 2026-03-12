/**
 * Test 5: CSV Parsing
 *
 * Loads the panel page directly, uploads a CSV that contains a {{Name}} column,
 * and verifies that the preview section resolves the variable correctly.
 */

import * as path from 'path';
import { test, expect, clearStorage } from './fixtures';

test.describe('CSV parsing', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorage(context);
  });

  test('{{Name}} variable is resolved in the message preview', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/panel.html?mode=email`);

    // Wait for the React app to mount
    await page.waitForSelector('#root > div', { timeout: 10000 });

    // Upload CSV via the hidden file input
    const csvPath = path.resolve(__dirname, '../fixtures/contacts-3-email.csv');
    await page.setInputFiles('input[type="file"]', csvPath);

    // Panel should report contacts loaded
    await expect(page.getByText('3 contacts loaded')).toBeVisible({ timeout: 8000 });

    // Open the preview section
    await page.locator('summary').filter({ hasText: 'Preview' }).click();

    // Set a template that uses {{Name}}
    await page.locator('textarea').fill('Hello {{Name}}, welcome!');

    // The preview should show the resolved first contact's name ('Alice')
    await expect(page.locator('pre')).toContainText('Hello Alice, welcome!', { timeout: 5000 });
  });
});
