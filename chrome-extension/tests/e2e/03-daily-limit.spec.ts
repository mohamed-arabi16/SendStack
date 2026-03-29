/**
 * Test 3: Daily Limit Enforcement
 *
 * Pre-sets chrome.storage so the daily limit is 2 and sent-today is already 0.
 * Then uploads a 5-row CSV and triggers a send job.  The content script should
 * stop after 2 successful sends and mark the remainder as skipped.
 */

import * as path from 'path';
import * as fs from 'fs';
import { test, expect, setStorage, clearStorage, FAST_SETTINGS } from './fixtures';

const MOCK_GMAIL = path.resolve(__dirname, 'mock-pages/gmail.html');

test.describe('Daily limit enforcement', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorage(context);
  });

  test('sending stops after the daily limit (limit=2, 5 contacts)', async ({ context }) => {
    // Pre-configure: daily limit = 2, today's count = 0
    const todayDate = new Date().toDateString();
    await setStorage(context, {
      settings: { ...FAST_SETTINGS, dailyLimit: 2 },
      dailyCount: { sent: 0, date: todayDate },
    });

    // Route mail.google.com to the mock Gmail page so content scripts inject
    await context.route('https://mail.google.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: fs.readFileSync(MOCK_GMAIL, 'utf8'),
      })
    );

    const page = await context.newPage();
    await page.goto('https://mail.google.com/');

    // Wait for the content script to inject the toggle button
    await page.waitForSelector('#bulk-sender-toggle', { timeout: 15000 });

    await page.evaluate(() => {
      window.addEventListener('message', (e) => {
        const d = e.data as { type: string };
        if (d?.type === 'BULK_SENDER_PROGRESS') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((window as any).__progress ??= []).push(d);
        }
        if (d?.type === 'BULK_SENDER_COMPLETE') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__complete = d;
        }
      });
    });

    // Trigger the send job directly (simulates panel → content-script message)
    const csvPath = path.resolve(__dirname, '../fixtures/contacts-5-email.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');

    // Parse CSV to contacts array
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    const contacts = lines.slice(1).map((line: string) => {
      const vals = line.split(',');
      return Object.fromEntries(headers.map((h: string, i: number) => [h.trim(), vals[i]?.trim() ?? '']));
    });

    const jobSettings = { ...FAST_SETTINGS, dailyLimit: 2 };
    await page.evaluate(
      ([contactsArg, settingsArg]: [Record<string, string>[], Record<string, unknown>]) => {
        window.postMessage(
          {
            type: 'START_EMAIL_JOB',
            contacts: contactsArg,
            template: 'Hi {{Name}}!',
            subject: 'Test Subject',
            settings: settingsArg,
          },
          '*'
        );
      },
      [contacts, jobSettings] as [typeof contacts, typeof jobSettings]
    );

    // Wait for the BULK_SENDER_COMPLETE event (or timeout)
    await page.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__complete !== undefined,
      { timeout: 30000 }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await page.evaluate(() => (window as any).__complete as { sent: number; failed: number; skipped: number });

    // Only 2 messages should be sent; the rest skipped
    expect(result).toBeTruthy();
    expect(result.sent).toBe(2);
    expect(result.sent + result.failed + result.skipped).toBe(5);

    // Verify compose window was opened exactly twice
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cycles = await page.evaluate(() => (window as any).__composeCycles ?? 0);
    expect(cycles).toBe(2);
  });
});
