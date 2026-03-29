/**
 * Shared Playwright fixtures for chrome-extension E2E tests.
 *
 * Usage:
 *   import { test, expect } from './fixtures';
 *
 * The `context` fixture launches a persistent Chrome context with the
 * unpacked extension loaded.  `extensionId` gives the generated ID so
 * tests can navigate to chrome-extension:// pages.
 */

import { test as base, chromium, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const EXTENSION_PATH = path.resolve(__dirname, '../../dist');

export type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
};

export const test = base.extend<ExtensionFixtures>({
  // Each test file gets its own isolated Chrome profile + extension instance.
  context: async ({}, fixtureUse) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-bulk-sender-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
    await fixtureUse(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, fixtureUse) => {
    // Wait for the service worker to register and extract the extension ID.
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
    const id = sw.url().split('/')[2];
    await fixtureUse(id);
  },
});

export { expect } from '@playwright/test';

// ---- Helpers ----

/**
 * Set chrome.storage.local values via the service worker.
 * Accepts any serialisable object.
 */
export async function setStorage(
  context: BrowserContext,
  items: Record<string, unknown>
): Promise<void> {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
  await sw.evaluate((data: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Promise<void>((resolve) => (self as any).chrome.storage.local.set(data, resolve));
  }, items as Record<string, unknown>);
}

/**
 * Clear chrome.storage.local via the service worker.
 */
export async function clearStorage(context: BrowserContext): Promise<void> {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await sw.evaluate(() => new Promise<void>((resolve) => (self as any).chrome.storage.local.clear(resolve)));
}

/**
 * Minimal "fast" settings payload for tests — short delays, no jitter.
 */
export const FAST_SETTINGS = {
  defaultMode: 'email',
  delayPreset: 'custom',
  customDelaySeconds: 3,
  jitterEnabled: false,
  batchSize: 50,
  cooldownSeconds: 10,
  dailyLimit: 200,
  spinSyntaxEnabled: false,
  sidebarPosition: 'right',
} as const;
