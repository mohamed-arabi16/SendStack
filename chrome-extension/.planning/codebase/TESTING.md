# Testing Patterns

**Analysis Date:** 2026-03-29

## Test Framework

**Runner:**
- Playwright Test 1.58.2
- Config: `playwright.config.ts`

**Assertion Library:**
- Playwright Test built-in `expect` (from `@playwright/test`)

**Run Commands:**
```bash
npm run test:e2e              # Run all end-to-end tests
```

**Test Structure:**
- Test files: `tests/e2e/*.spec.ts`
- Shared fixtures: `tests/e2e/fixtures.ts`
- Global setup: `tests/e2e/global-setup.ts`
- Mock pages: `tests/e2e/mock-pages/`
- Test fixtures/data: `tests/fixtures/`

## Test File Organization

**Location:**
- All tests are E2E, located in `tests/e2e/` directory
- No unit tests or integration tests in separate directories
- Tests are physically separate from source code

**Naming:**
- Pattern: `NN-description.spec.ts` (numbered prefix for execution order)
  - `01-gmail-bulk-send.spec.ts`
  - `02-whatsapp-bulk-send.spec.ts`
  - `03-daily-limit.spec.ts`
  - `04-settings-persistence.spec.ts`
  - `05-csv-parsing.spec.ts`

**Directory structure:**
```
tests/
├── e2e/
│   ├── global-setup.ts
│   ├── fixtures.ts
│   ├── 01-gmail-bulk-send.spec.ts
│   ├── 02-whatsapp-bulk-send.spec.ts
│   ├── 03-daily-limit.spec.ts
│   ├── 04-settings-persistence.spec.ts
│   ├── 05-csv-parsing.spec.ts
│   └── mock-pages/
│       ├── gmail.html
│       ├── whatsapp.html
│       └── whatsapp-send.html
└── fixtures/
    ├── contacts-5-email.csv
    └── (other test data files)
```

## Test Structure

**Suite Organization:**
```typescript
import { test, expect, clearStorage, FAST_SETTINGS } from './fixtures';

test.describe('Gmail bulk send', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorage(context);
  });

  test('3 contacts → 3 compose cycles, BULK_SENDER_COMPLETE with sent=3', async ({ context }) => {
    // Setup
    // Action
    // Assert
  });
});
```

**Test Lifecycle:**
- `test.beforeEach()`: Clear browser storage before each test
- `test.describe()`: Group related tests
- `test()`: Individual test case
- Cleanup: Automatic context teardown (fixtures handle browser cleanup)

**Patterns:**
- **Setup phase**: Route mocks, set storage via `setStorage()`, create pages
- **Action phase**: User interactions via Playwright (navigate, wait, evaluate)
- **Assert phase**: `expect()` assertions on captured state

**Example from `01-gmail-bulk-send.spec.ts`:**
```typescript
test('3 contacts → 3 compose cycles, BULK_SENDER_COMPLETE with sent=3', async ({ context }) => {
  // Setup: route mock Gmail page
  await context.route('https://mail.google.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: fs.readFileSync(MOCK_GMAIL, 'utf8'),
    })
  );

  const page = await context.newPage();
  await page.goto('https://mail.google.com/');

  // Set up message listener before starting job
  await page.evaluate(() => {
    (window as any).__complete = undefined;
    window.addEventListener('message', (e) => {
      const d = e.data as { type: string };
      if (d?.type === 'BULK_SENDER_COMPLETE') {
        (window as any).__complete = d;
      }
    });
  });

  // Action: trigger email job
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

  // Assert: wait for completion and verify results
  await page.waitForFunction(
    () => (window as any).__complete !== undefined,
    { timeout: 30000 }
  );

  const result = await page.evaluate(() => (window as any).__complete);
  expect(result).toBeTruthy();
  expect(result.sent).toBe(3);
  expect(result.failed).toBe(0);
});
```

## Mocking

**Framework:** Playwright Test's built-in route interception (`context.route()`)

**Patterns:**
```typescript
// Route mocking pattern
await context.route('https://mail.google.com/**', (route) =>
  route.fulfill({
    contentType: 'text/html',
    body: fs.readFileSync(MOCK_GMAIL, 'utf8'),
  })
);

// Conditional routing based on request
await context.route('https://web.whatsapp.com/**', (route) => {
  const url = route.request().url();
  if (url.includes('phone=')) {
    route.fulfill({ contentType: 'text/html', body: fs.readFileSync(MOCK_WA_SEND, 'utf8') });
  } else {
    route.fulfill({ contentType: 'text/html', body: fs.readFileSync(MOCK_WA_MAIN, 'utf8') });
  }
});
```

**What to Mock:**
- External URLs (Gmail, WhatsApp Web) → routed to local HTML mock pages
- Chrome Storage API → mocked via fixtures (`setStorage()`, `clearStorage()`)
- Page navigation events → tracked via `page.on('framenavigated')`

**What NOT to Mock:**
- Extension's content scripts (injected and run in real page context)
- Chrome API calls from service worker (use real Chrome APIs in test environment)
- User interactions (native page automation via Playwright)

## Fixtures and Factories

**Test Data:**

Mock pages are stored as HTML files and loaded via filesystem:

```typescript
const MOCK_GMAIL = path.resolve(__dirname, 'mock-pages/gmail.html');
const MOCK_WA_MAIN = path.resolve(__dirname, 'mock-pages/whatsapp.html');
const MOCK_WA_SEND = path.resolve(__dirname, 'mock-pages/whatsapp-send.html');
```

**Contact fixtures:**
```typescript
const CONTACTS = [
  { email: 'alice@example.com', Name: 'Alice' },
  { email: 'bob@example.com', Name: 'Bob' },
  { email: 'carol@example.com', Name: 'Carol' },
];
```

**Settings fixtures:**
```typescript
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
```

**Location:**
- Mock pages: `tests/e2e/mock-pages/`
- Shared fixtures (constants/functions): `tests/e2e/fixtures.ts`
- CSV test data: `tests/fixtures/contacts-5-email.csv`

**Fixture helpers from `tests/e2e/fixtures.ts`:**
```typescript
// Set chrome.storage.local via service worker
export async function setStorage(
  context: BrowserContext,
  items: Record<string, unknown>
): Promise<void> { /* ... */ }

// Clear all storage
export async function clearStorage(context: BrowserContext): Promise<void> { /* ... */ }

// Re-exported for test files
export { expect } from '@playwright/test';
```

## Coverage

**Requirements:** No enforced coverage targets

**View Coverage:** Not configured (no coverage collection in playwright.config.ts)

**Test scope:**
- E2E tests focus on critical workflows (bulk send, daily limits, settings persistence, CSV parsing)
- No unit test coverage collected
- Tests are scenario-based rather than line-coverage driven

## Test Types

**Unit Tests:**
- Not present in codebase
- Business logic (`csv-parser.ts`, `storage.ts`) untested in isolation

**Integration Tests:**
- Not explicitly distinguished from E2E tests
- Some tests verify integration between content script and background service worker

**E2E Tests:**
- 5 test suites covering main extension scenarios:
  1. **Gmail bulk send** (`01-gmail-bulk-send.spec.ts`): Verify 3 contacts trigger 3 compose cycles
  2. **WhatsApp bulk send** (`02-whatsapp-bulk-send.spec.ts`): Verify navigation to phone URLs
  3. **Daily limit enforcement** (`03-daily-limit.spec.ts`): Verify sending stops at daily limit
  4. **Settings persistence** (`04-settings-persistence.spec.ts`): Verify settings saved/loaded correctly
  5. **CSV parsing** (`05-csv-parsing.spec.ts`): Verify CSV upload and contact parsing

## Common Patterns

**Async Testing:**
```typescript
// Using page.waitForFunction() for polling
await page.waitForFunction(
  () => (window as any).__complete !== undefined,
  { timeout: 30000 }
);

// Using page.waitForSelector() for DOM appearance
await page.waitForSelector('#bulk-sender-toggle', { timeout: 15000 });

// Capturing state via page.evaluate()
const result = await page.evaluate(() => (window as any).__complete);
```

**Error Testing:**
Not explicitly tested in current suite; error paths tested implicitly through daily-limit and send-completion scenarios.

## Extension-Specific Patterns

**Context Fixture:**
```typescript
export const test = base.extend<ExtensionFixtures>({
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
  // ...
});
```

**Extension ID Resolution:**
```typescript
extensionId: async ({ context }, fixtureUse) => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const id = sw.url().split('/')[2];
  await fixtureUse(id);
}
```

This allows tests to navigate to `chrome-extension://{id}/panel.html` and interact with extension pages.

**Message Passing in Tests:**
```typescript
// Tests communicate with content scripts via postMessage
await page.evaluate(
  ([contacts, settings]) => {
    window.postMessage(
      { type: 'START_EMAIL_JOB', contacts, template: 'Hello {{Name}}!', subject: 'Bulk Test', settings },
      '*'
    );
  },
  [CONTACTS, settings] as [typeof CONTACTS, typeof settings]
);

// Listen for completion events
window.addEventListener('message', (e) => {
  if (e.data?.type === 'BULK_SENDER_COMPLETE') {
    (window as any).__complete = e.data;
  }
});
```

## Build Integration

**Global Setup:**
```typescript
// tests/e2e/global-setup.ts
export default async function globalSetup() {
  const root = path.resolve(__dirname, '../../');
  console.log('[global-setup] Building extension…');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
  console.log('[global-setup] Extension built.');
}
```

Tests build the extension before running (`globalSetup` in `playwright.config.ts`).

---

*Testing analysis: 2026-03-29*
