/**
 * Test 2: WhatsApp Bulk Send
 *
 * Routes web.whatsapp.com to mock pages.  The main page returns the chat-list
 * mock (which triggers panel injection); send-page URLs return the send UI mock
 * (footer contenteditable + send button).
 *
 * The test injects a START_WA_JOB message and then counts navigations to
 * /send?phone=... URLs.  The content script stores the job in the background
 * service worker and processes one contact per page load, so 3 contacts produce
 * exactly 3 navigations to send URLs before the job completes.
 */

import * as path from 'path';
import * as fs from 'fs';
import { test, expect, setStorage, clearStorage, FAST_SETTINGS } from './fixtures';

const MOCK_WA_MAIN = path.resolve(__dirname, 'mock-pages/whatsapp.html');
const MOCK_WA_SEND = path.resolve(__dirname, 'mock-pages/whatsapp-send.html');

const CONTACTS = [
  { email: 'alice@example.com', phone: '14155551234', Name: 'Alice' },
  { email: 'bob@example.com', phone: '14155555678', Name: 'Bob' },
  { email: 'carol@example.com', phone: '14155559012', Name: 'Carol' },
];

// Settings with minimal delays so the test completes quickly
const WA_SETTINGS = { ...FAST_SETTINGS, defaultMode: 'whatsapp', dailyLimit: 200 };

test.describe('WhatsApp bulk send', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorage(context);
  });

  test('sendViaWhatsAppWeb is called for each of 3 contacts', async ({ context }) => {
    // Route all WhatsApp Web requests to the appropriate mock page
    await context.route('https://web.whatsapp.com/**', (route) => {
      const url = route.request().url();
      if (url.includes('phone=')) {
        route.fulfill({ contentType: 'text/html', body: fs.readFileSync(MOCK_WA_SEND, 'utf8') });
      } else {
        route.fulfill({ contentType: 'text/html', body: fs.readFileSync(MOCK_WA_MAIN, 'utf8') });
      }
    });

    const page = await context.newPage();

    // Track navigations to /send?phone=... URLs
    const phonesSeen: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      const url = frame.url();
      const m = url.match(/phone=(\d+)/);
      if (m) phonesSeen.push(m[1]);
    });

    // Load the main WhatsApp mock page
    await page.goto('https://web.whatsapp.com/');

    // Wait for the toggle button (confirms content-script injection)
    await page.waitForSelector('#bulk-sender-toggle', { timeout: 20000 });

    // Trigger the WhatsApp bulk-send job
    await page.evaluate(
      ([contacts, settings]) => {
        window.postMessage(
          { type: 'START_WA_JOB', contacts, template: 'Hi {{Name}}!', settings },
          '*'
        );
      },
      [CONTACTS, WA_SETTINGS] as [typeof CONTACTS, typeof WA_SETTINGS]
    );

    // Wait until we have seen 3 /send?phone=... navigations
    // (Each represents one call to sendViaWhatsAppWeb / processCurrentContact)
    await page.waitForFunction(
      () => {
        // The last page will post BULK_SENDER_COMPLETE to its window
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        return w.__waSendClicks !== undefined && w.__waSendClicks > 0;
      },
      { timeout: 30000 }
    );

    // Allow the final navigation's send to register
    await page.waitForTimeout(2000);

    // All three phone numbers should have been navigated to
    expect(phonesSeen).toContain('14155551234');
    expect(phonesSeen).toContain('14155555678');
    expect(phonesSeen).toContain('14155559012');
    expect(phonesSeen.length).toBe(3);
  });
});
