/**
 * Test 1: Gmail Bulk Send
 *
 * Routes mail.google.com to a mock Gmail page.  The content script injects
 * the panel toggle button automatically.  A START_EMAIL_JOB message (simulating
 * what the panel iframe posts) is injected via page.evaluate, and the test
 * verifies that the mock Gmail compose dialog opened and closed exactly 3 times
 * and that the BULK_SENDER_COMPLETE event reports sent=3.
 */

import * as path from 'path';
import * as fs from 'fs';
import { test, expect, clearStorage, FAST_SETTINGS } from './fixtures';

const MOCK_GMAIL = path.resolve(__dirname, 'mock-pages/gmail.html');

const CONTACTS = [
  { email: 'alice@example.com', Name: 'Alice' },
  { email: 'bob@example.com', Name: 'Bob' },
  { email: 'carol@example.com', Name: 'Carol' },
];

test.describe('Gmail bulk send', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorage(context);
  });

  test('3 contacts → 3 compose cycles, BULK_SENDER_COMPLETE with sent=3', async ({ context }) => {
    // Serve the mock Gmail page for all mail.google.com requests
    await context.route('https://mail.google.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: fs.readFileSync(MOCK_GMAIL, 'utf8'),
      })
    );

    const page = await context.newPage();
    await page.goto('https://mail.google.com/');

    // Content script should inject the toggle button
    await page.waitForSelector('#bulk-sender-toggle', { timeout: 15000 });

    // Set up message listener in the page before starting the job
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__complete = undefined;
      window.addEventListener('message', (e) => {
        const d = e.data as { type: string };
        if (d?.type === 'BULK_SENDER_COMPLETE') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__complete = d;
        }
      });
    });

    // Trigger the email job (simulating the panel iframe's postMessage)
    const settings = { ...FAST_SETTINGS, dailyLimit: 200 };
    await page.evaluate(
      ([contacts, s]) => {
        window.postMessage(
          { type: 'START_EMAIL_JOB', contacts, template: 'Hello {{Name}}!', subject: 'Bulk Test', settings: s },
          '*'
        );
      },
      [CONTACTS, settings] as [typeof CONTACTS, typeof settings]
    );

    // Wait for the job to complete (up to 30 s)
    await page.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__complete !== undefined,
      { timeout: 30000 }
    );

    // Verify all 3 were sent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await page.evaluate(() => (window as any).__complete as { sent: number; failed: number; skipped: number });
    expect(result).toBeTruthy();
    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);

    // Verify 3 compose dialogs were opened (and closed) in the mock page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cycles = await page.evaluate(() => (window as any).__composeCycles ?? 0);
    expect(cycles).toBe(3);
  });
});
