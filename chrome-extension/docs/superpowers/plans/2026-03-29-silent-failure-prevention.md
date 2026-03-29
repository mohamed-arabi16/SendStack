# Silent Failure Prevention — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all silent failures in the extension — every error is visible to the user via panel banners, Chrome notifications, or persistent job status.

**Architecture:** A selector registry with fallback chains replaces hardcoded selectors. A pre-flight check runs on panel open. A circuit breaker (3 consecutive failures) halts bulk jobs. Three tiers of error surfacing ensure visibility: panel banner (active use), Chrome notifications (panel not visible), persistent job status (across navigations).

**Tech Stack:** TypeScript, Chrome Extension APIs (notifications, storage), React

**Note:** No unit test framework exists in this project. Verification is via `npm run build` (TypeScript compilation) + manual load in Chrome. Each task ends with a build check.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/selectors.ts` | SelectorError class, WhatsApp/Gmail selector registries, `findElement()` with fallback chains, `runPreflight()` |
| `src/lib/circuit-breaker.ts` | CIRCUIT_BREAKER_THRESHOLD constant, RETRY_ATTEMPTS, RETRY_BACKOFF_MS, `isRetryableError()` helper |

### Modified Files
| File | Changes |
|------|---------|
| `manifest.json` | Add `"notifications"` permission |
| `src/lib/messaging.ts` | Add `'FIRE_NOTIFICATION'` to MessageAction union |
| `src/background.ts` | Add `FIRE_NOTIFICATION` handler, update `WaJobState` with `consecutiveFailures`/`lastError`, return halted jobs from `GET_ACTIVE_WA_JOB` |
| `src/content-whatsapp.ts` | Use selector registry, add preflight handler, add retry + circuit breaker, replace all silent catches with notifications |
| `src/content-gmail.ts` | Use selector registry, add preflight handler, add circuit breaker to email job loop, replace all silent catches |
| `src/panel/App.tsx` | Send preflight on mount, show ready/blocked indicator, show halted job recovery UI, replace all `.catch(console.error)` with `setErrorBanner()` |

---

### Task 1: Create Selector Registry

**Files:**
- Create: `src/lib/selectors.ts`

- [ ] **Step 1: Create `src/lib/selectors.ts`**

```typescript
export class SelectorError extends Error {
  selectorName: string;
  constructor(selectorName: string) {
    super(`${selectorName} not found`);
    this.name = 'SelectorError';
    this.selectorName = selectorName;
  }
}

export interface SelectorDef {
  name: string;
  selectors: string[];
  critical: boolean;
}

export const WHATSAPP_SELECTORS: SelectorDef[] = [
  { name: 'CHAT_LIST', selectors: ['#pane-side', '[data-testid="chat-list"]'], critical: true },
  { name: 'MSG_INPUT', selectors: ['footer [contenteditable="true"]', '[data-testid="conversation-compose-box-input"]'], critical: true },
  { name: 'SEND_BUTTON', selectors: ['[data-testid="send"]', '[aria-label="Send"]', 'footer button[aria-label]'], critical: false },
  { name: 'INVALID_PHONE', selectors: ['[data-testid="intro-text"]'], critical: false },
];

export const GMAIL_SELECTORS: SelectorDef[] = [
  { name: 'NAV', selectors: ['[role="navigation"]'], critical: true },
  { name: 'COMPOSE_BTN', selectors: ['[gh="cm"]'], critical: true },
  { name: 'TO_FIELD', selectors: ['[role="dialog"] [name="to"]'], critical: false },
  { name: 'SUBJECT', selectors: ['[name="subjectbox"]'], critical: false },
  { name: 'BODY', selectors: ['[role="textbox"][aria-label]'], critical: false },
  { name: 'SEND_BTN', selectors: ['[data-tooltip*="Send"]', '[aria-label*="Send"]'], critical: false },
];

export function findElement(def: SelectorDef, timeout = 15000): Promise<Element> {
  return new Promise((resolve, reject) => {
    for (const sel of def.selectors) {
      const el = document.querySelector(sel);
      if (el) { resolve(el); return; }
    }
    const observer = new MutationObserver(() => {
      for (const sel of def.selectors) {
        const el = document.querySelector(sel);
        if (el) { observer.disconnect(); resolve(el); return; }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new SelectorError(def.name)); }, timeout);
  });
}

export function findSelector(name: string, registry: SelectorDef[]): SelectorDef {
  const def = registry.find(d => d.name === name);
  if (!def) throw new Error(`Unknown selector: ${name}`);
  return def;
}

export async function runPreflight(registry: SelectorDef[]): Promise<{ ready: boolean; failures: string[] }> {
  const critical = registry.filter(d => d.critical);
  const failures: string[] = [];
  for (const def of critical) {
    try {
      await findElement(def, 3000);
    } catch {
      failures.push(def.name);
    }
  }
  return { ready: failures.length === 0, failures };
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/selectors.ts
git commit -m "feat: add selector registry with fallback chains and pre-flight check"
```

---

### Task 2: Create Circuit Breaker Module

**Files:**
- Create: `src/lib/circuit-breaker.ts`

- [ ] **Step 1: Create `src/lib/circuit-breaker.ts`**

```typescript
import { SelectorError } from './selectors';

export const CIRCUIT_BREAKER_THRESHOLD = 3;
export const RETRY_ATTEMPTS = 2;
export const RETRY_BACKOFF_MS = 3000;

export function isRetryableError(err: unknown): boolean {
  if (err instanceof SelectorError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('not found')) return true;
  }
  return false;
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/circuit-breaker.ts
git commit -m "feat: add circuit breaker constants and retry helpers"
```

---

### Task 3: Update Manifest, Messaging, and Background

**Files:**
- Modify: `manifest.json` (add `"notifications"` permission)
- Modify: `src/lib/messaging.ts` (add new action type)
- Modify: `src/background.ts` (add notification handler, update WaJobState, update getActiveWaJob)

- [ ] **Step 1: Add `"notifications"` to manifest permissions**

In `manifest.json`, change:
```json
"permissions": ["storage", "alarms", "activeTab", "scripting"],
```
to:
```json
"permissions": ["storage", "alarms", "activeTab", "scripting", "notifications"],
```

- [ ] **Step 2: Add `FIRE_NOTIFICATION` to messaging types**

In `src/lib/messaging.ts`, change the MessageAction type:
```typescript
export type MessageAction =
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'GET_DAILY_COUNT'
  | 'INCREMENT_COUNT'
  | 'RESET_COUNT'
  | 'START_JOB'
  | 'CANCEL_JOB'
  | 'STORE_WA_JOB'
  | 'GET_ACTIVE_WA_JOB'
  | 'ADVANCE_WA_JOB'
  | 'CANCEL_WA_JOB'
  | 'FIRE_NOTIFICATION';
```

- [ ] **Step 3: Update WaJobState in background.ts**

In `src/background.ts`, change the WaJobState interface:
```typescript
export interface WaJobState {
  jobId: string;
  contacts: Contact[];
  template: string;
  settings: ExtensionSettings;
  currentIndex: number;
  sent: number;
  failed: number;
  status: 'running' | 'cancelled' | 'completed' | 'halted';
  consecutiveFailures: number;
  lastError: string;
}
```

- [ ] **Step 4: Update getActiveWaJob to also return halted jobs**

In `src/background.ts`, change `getActiveWaJob`:
```typescript
async function getActiveWaJob(): Promise<WaJobState | null> {
  if (_activeWaJob?.status === 'running' || _activeWaJob?.status === 'halted') return _activeWaJob;
  return new Promise((resolve) => {
    chrome.storage.local.get('activeWaJob', (result) => {
      const job = result['activeWaJob'] as WaJobState | undefined;
      _activeWaJob = (job?.status === 'running' || job?.status === 'halted') ? job : null;
      resolve(_activeWaJob);
    });
  });
}
```

- [ ] **Step 5: Add FIRE_NOTIFICATION handler to handleMessage**

In `src/background.ts`, add this case inside the `handleMessage` switch, before the `default:` case:

```typescript
    case 'FIRE_NOTIFICATION': {
      const { title, message: msg } = message.payload as { title: string; message: string };
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title ?? 'SendStack',
        message: msg ?? 'An error occurred',
      });
      return { ok: true };
    }
```

- [ ] **Step 6: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add manifest.json src/lib/messaging.ts src/background.ts
git commit -m "feat: add notifications permission, FIRE_NOTIFICATION handler, halted job support"
```

---

### Task 4: Rewrite WhatsApp Content Script

**Files:**
- Modify: `src/content-whatsapp.ts`

This is the largest change. Replace the entire file content.

- [ ] **Step 1: Rewrite `src/content-whatsapp.ts`**

Replace the full file with:

```typescript
import { resolveTemplate, resolveSpin, applyJitter, sleep } from './lib/csv-parser';
import type { Contact } from './lib/csv-parser';
import { sendToBackground } from './lib/messaging';
import type { ExtensionSettings } from './lib/storage';
import type { WaJobState } from './background';
import { findElement, findSelector, runPreflight, SelectorError, WHATSAPP_SELECTORS } from './lib/selectors';
import { CIRCUIT_BREAKER_THRESHOLD, RETRY_ATTEMPTS, RETRY_BACKOFF_MS, isRetryableError } from './lib/circuit-breaker';

let panelVisible = false;
let shadowHost: HTMLDivElement | null = null;
let panelIframe: HTMLIFrameElement | null = null;

function notifyError(message: string) {
  sendToBackground('FIRE_NOTIFICATION', { title: 'SendStack', message }).catch(() => {});
}

function postToPanel(data: Record<string, unknown>) {
  panelIframe?.contentWindow?.postMessage(data, '*');
}

async function injectPanel() {
  if (window.location.search.includes('phone=')) {
    await processCurrentContact();
    return;
  }

  // Wait for WhatsApp to load (non-blocking — inject panel regardless)
  try {
    await findElement(findSelector('CHAT_LIST', WHATSAPP_SELECTORS), 20000);
  } catch {
    // Will be caught by pre-flight check in panel
  }

  // Floating toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'bulk-sender-toggle';
  toggleBtn.textContent = '\uD83D\uDCAC Bulk Sender';
  toggleBtn.style.cssText = [
    'position:fixed', 'right:0', 'top:50%', 'transform:translateY(-50%)',
    'z-index:99999', 'background:#25d366', 'color:#fff', 'border:none',
    'border-radius:8px 0 0 8px', 'padding:12px 10px', 'cursor:pointer',
    'font-size:13px', 'font-family:sans-serif', 'writing-mode:vertical-rl',
    'text-orientation:mixed', 'box-shadow:-2px 0 8px rgba(0,0,0,0.2)',
  ].join(';');
  toggleBtn.addEventListener('click', togglePanel);
  document.body.appendChild(toggleBtn);

  // Shadow DOM host
  shadowHost = document.createElement('div');
  shadowHost.id = 'bulk-sender-panel-host';
  shadowHost.style.cssText = [
    'position:fixed', 'right:0', 'top:0', 'height:100vh', 'width:420px',
    'z-index:99998', 'display:none', 'box-shadow:-4px 0 20px rgba(0,0,0,0.15)',
  ].join(';');
  document.body.appendChild(shadowHost);

  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('panel.html') + '?mode=whatsapp';
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.onerror = () => notifyError('Panel failed to load on WhatsApp Web');
  shadowRoot.appendChild(iframe);
  panelIframe = iframe;

  window.addEventListener('message', handlePanelMessage);
}

function togglePanel() {
  panelVisible = !panelVisible;
  if (shadowHost) {
    shadowHost.style.display = panelVisible ? 'block' : 'none';
  }
}

// ---- Retry wrapper ----

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === RETRY_ATTEMPTS) throw err;
      await sleep(RETRY_BACKOFF_MS);
    }
  }
  throw lastError;
}

// ---- Process the current contact on a /send?phone=... page ----

async function processCurrentContact(): Promise<void> {
  const job = await sendToBackground<WaJobState | null>('GET_ACTIVE_WA_JOB');
  if (!job || job.status !== 'running') return;

  const contact = job.contacts[job.currentIndex];
  if (!contact) return;

  const phone = contact.phone ?? '';
  const total = job.contacts.length;
  let sent = job.sent;
  let failed = job.failed;
  let consecutiveFailures = job.consecutiveFailures ?? 0;

  // Enforce daily limit
  const { sent: dailySent, limit: dailyLimit } =
    await sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT');
  if (dailySent >= dailyLimit) {
    await sendToBackground('CANCEL_WA_JOB', {});
    notifyError(`Daily limit reached (${dailyLimit}). Job stopped after ${sent} sent.`);
    return;
  }

  let resolvedMsg = resolveTemplate(job.template, contact);
  if (job.settings.spinSyntaxEnabled) resolvedMsg = resolveSpin(resolvedMsg);

  try {
    await withRetry(() => doSendOnCurrentPage(phone, resolvedMsg));
    sent++;
    consecutiveFailures = 0;
    await sendToBackground('INCREMENT_COUNT', { n: 1 });
  } catch (err) {
    failed++;
    consecutiveFailures++;

    // Circuit breaker check
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      const errorMsg = err instanceof SelectorError
        ? `${err.selectorName} not found — WhatsApp may have changed its UI`
        : String(err);
      const haltedJob: WaJobState = {
        ...job, sent, failed, consecutiveFailures,
        status: 'halted', lastError: errorMsg,
      };
      await sendToBackground('STORE_WA_JOB', haltedJob as unknown as Record<string, unknown>);
      notifyError(`Job halted after ${sent}/${total} — ${errorMsg}`);
      return;
    }
  }

  // Advance job in background
  const { nextIndex, status } =
    await sendToBackground<{ nextIndex: number; status: WaJobState['status'] }>('ADVANCE_WA_JOB', { sent, failed, consecutiveFailures });

  if (status === 'completed' || status === 'cancelled') return;

  // Inter-message delay
  const batchSize = job.settings.batchSize;
  if (nextIndex % batchSize === 0) {
    await sleep(job.settings.cooldownSeconds * 1000);
  } else {
    const delayMap: Record<string, number> = { fast: 5000, normal: 10000, safe: 15000 };
    const base = job.settings.delayPreset === 'custom'
      ? job.settings.customDelaySeconds * 1000
      : (delayMap[job.settings.delayPreset] ?? 10000);
    const delay = job.settings.jitterEnabled ? applyJitter(base) : base;
    await sleep(delay);
  }

  // Navigate to next contact
  const nextContact = job.contacts[nextIndex];
  const nextPhone = nextContact?.phone?.replace(/[\s\-+]/g, '') ?? '';
  if (nextPhone) {
    window.location.href = `https://web.whatsapp.com/send?phone=${nextPhone}`;
  }
}

// ---- WhatsApp send interaction on the current page ----

async function doSendOnCurrentPage(phone: string, message: string): Promise<void> {
  const msgInputDef = findSelector('MSG_INPUT', WHATSAPP_SELECTORS);
  const input = await findElement(msgInputDef, 20000) as HTMLElement;

  await sleep(1000);
  const invalidPhoneDef = findSelector('INVALID_PHONE', WHATSAPP_SELECTORS);
  for (const sel of invalidPhoneDef.selectors) {
    const invalidMsg = document.querySelector(sel);
    if (invalidMsg?.textContent?.includes('Phone number shared via url is invalid')) {
      throw new Error(`Phone ${phone} is not on WhatsApp`);
    }
  }

  input.focus();
  document.execCommand('insertText', false, message);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(300);

  const sendBtnDef = findSelector('SEND_BUTTON', WHATSAPP_SELECTORS);
  let sendBtn: Element | null = null;
  for (const sel of sendBtnDef.selectors) {
    sendBtn = document.querySelector(sel);
    if (sendBtn) break;
  }
  if (sendBtn) {
    (sendBtn as HTMLElement).click();
  } else {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  await sleep(500);
}

// ---- Panel message handler (main page only) ----

async function handlePanelMessage(event: MessageEvent) {
  const data = event.data as { type: string; [key: string]: unknown };
  if (!data || !data.type) return;

  if (data.type === 'PREFLIGHT_CHECK') {
    const result = await runPreflight(WHATSAPP_SELECTORS);
    postToPanel({ type: 'PREFLIGHT_RESULT', ...result });
  } else if (data.type === 'START_WA_JOB') {
    const { contacts, template, settings } = data as unknown as {
      contacts: Contact[]; template: string; settings: ExtensionSettings;
    };
    startWaJob(contacts, template, settings).catch((err) => {
      postToPanel({ type: 'JOB_START_ERROR', error: String(err) });
    });
  } else if (data.type === 'CANCEL_JOB') {
    sendToBackground('CANCEL_WA_JOB', {}).catch((err) => notifyError(String(err)));
  }
}

async function startWaJob(contacts: Contact[], template: string, settings: ExtensionSettings): Promise<void> {
  const jobId = `wa-${Date.now()}`;
  const job: WaJobState = {
    jobId, contacts, template, settings,
    currentIndex: 0, sent: 0, failed: 0, status: 'running',
    consecutiveFailures: 0, lastError: '',
  };
  await sendToBackground('STORE_WA_JOB', job as unknown as Record<string, unknown>);

  const firstPhone = contacts[0]?.phone?.replace(/[\s\-+]/g, '') ?? '';
  if (firstPhone) {
    window.location.href = `https://web.whatsapp.com/send?phone=${firstPhone}`;
  }
}

injectPanel().catch((err) => notifyError(`Failed to load on WhatsApp Web: ${String(err)}`));
```

- [ ] **Step 2: Update advanceWaJob in background.ts to accept consecutiveFailures**

In `src/background.ts`, change the `advanceWaJob` function:

```typescript
async function advanceWaJob(
  updates: { sent: number; failed: number; consecutiveFailures?: number }
): Promise<{ nextIndex: number; status: WaJobState['status'] }> {
  const job = await getActiveWaJob();
  if (!job) return { nextIndex: -1, status: 'completed' };
  job.currentIndex++;
  job.sent = updates.sent;
  job.failed = updates.failed;
  if (updates.consecutiveFailures !== undefined) {
    job.consecutiveFailures = updates.consecutiveFailures;
  }
  if (job.currentIndex >= job.contacts.length) job.status = 'completed';
  await storeWaJob(job);
  return { nextIndex: job.currentIndex, status: job.status };
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/content-whatsapp.ts src/background.ts
git commit -m "feat: WhatsApp content script with selector registry, retry, circuit breaker, error reporting"
```

---

### Task 5: Rewrite Gmail Content Script

**Files:**
- Modify: `src/content-gmail.ts`

- [ ] **Step 1: Rewrite `src/content-gmail.ts`**

Replace the full file with:

```typescript
import { resolveTemplate, resolveSpin, applyJitter, sleep } from './lib/csv-parser';
import type { Contact } from './lib/csv-parser';
import { sendToBackground } from './lib/messaging';
import type { ExtensionSettings } from './lib/storage';
import { findElement, findSelector, runPreflight, GMAIL_SELECTORS } from './lib/selectors';
import { CIRCUIT_BREAKER_THRESHOLD, RETRY_ATTEMPTS, RETRY_BACKOFF_MS, isRetryableError } from './lib/circuit-breaker';

let panelVisible = false;
let shadowHost: HTMLDivElement | null = null;
let panelIframe: HTMLIFrameElement | null = null;
let cancelRequested = false;

function notifyError(message: string) {
  sendToBackground('FIRE_NOTIFICATION', { title: 'SendStack', message }).catch(() => {});
}

function postToPanel(data: Record<string, unknown>) {
  panelIframe?.contentWindow?.postMessage(data, '*');
}

async function injectPanel() {
  // Wait for Gmail to load (non-blocking)
  try {
    await findElement(findSelector('NAV', GMAIL_SELECTORS), 15000);
  } catch {
    // Will be caught by pre-flight check in panel
  }

  // Create floating toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'bulk-sender-toggle';
  toggleBtn.textContent = '\u2709 Bulk Sender';
  toggleBtn.style.cssText = [
    'position:fixed', 'right:0', 'top:50%', 'transform:translateY(-50%)',
    'z-index:99999', 'background:#1a73e8', 'color:#fff', 'border:none',
    'border-radius:8px 0 0 8px', 'padding:12px 10px', 'cursor:pointer',
    'font-size:13px', 'font-family:sans-serif', 'writing-mode:vertical-rl',
    'text-orientation:mixed', 'box-shadow:-2px 0 8px rgba(0,0,0,0.2)',
  ].join(';');
  toggleBtn.addEventListener('click', togglePanel);
  document.body.appendChild(toggleBtn);

  // Create shadow DOM container
  shadowHost = document.createElement('div');
  shadowHost.id = 'bulk-sender-panel-host';
  shadowHost.style.cssText = [
    'position:fixed', 'right:0', 'top:0', 'height:100vh', 'width:420px',
    'z-index:99998', 'display:none', 'box-shadow:-4px 0 20px rgba(0,0,0,0.15)',
  ].join(';');
  document.body.appendChild(shadowHost);

  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('panel.html') + '?mode=email';
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.onerror = () => notifyError('Panel failed to load on Gmail');
  shadowRoot.appendChild(iframe);
  panelIframe = iframe;

  window.addEventListener('message', handlePanelMessage);

  // Forward progress messages to the panel iframe
  window.addEventListener('message', (event) => {
    const data = event.data as { type?: string };
    if (!data?.type) return;
    if (data.type === 'BULK_SENDER_PROGRESS' || data.type === 'BULK_SENDER_COOLDOWN' || data.type === 'BULK_SENDER_COMPLETE') {
      postToPanel(event.data as Record<string, unknown>);
    }
  });
}

function togglePanel() {
  panelVisible = !panelVisible;
  if (shadowHost) {
    shadowHost.style.display = panelVisible ? 'block' : 'none';
  }
}

// ---- Retry wrapper ----

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === RETRY_ATTEMPTS) throw err;
      await sleep(RETRY_BACKOFF_MS);
    }
  }
  throw lastError;
}

// ---- Gmail Compose automation ----

async function doSend(to: string, subject: string, body: string): Promise<void> {
  const composeBtnDef = findSelector('COMPOSE_BTN', GMAIL_SELECTORS);
  let composeBtn: Element | null = null;
  for (const sel of composeBtnDef.selectors) {
    composeBtn = document.querySelector(sel);
    if (composeBtn) break;
  }
  if (composeBtn) {
    (composeBtn as HTMLElement).click();
  } else {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
  }

  const toFieldDef = findSelector('TO_FIELD', GMAIL_SELECTORS);
  const composeWindow = await findElement(toFieldDef, 5000) as HTMLInputElement;

  composeWindow.focus();
  setNativeValue(composeWindow, to);
  composeWindow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  await sleep(300);

  const subjectDef = findSelector('SUBJECT', GMAIL_SELECTORS);
  let subjectField: Element | null = null;
  for (const sel of subjectDef.selectors) {
    subjectField = document.querySelector(sel);
    if (subjectField) break;
  }
  if (subjectField) {
    (subjectField as HTMLInputElement).focus();
    setNativeValue(subjectField as HTMLInputElement, subject);
  }
  await sleep(300);

  const bodyDef = findSelector('BODY', GMAIL_SELECTORS);
  let bodyField: Element | null = null;
  for (const sel of bodyDef.selectors) {
    bodyField = document.querySelector(sel);
    if (bodyField) break;
  }
  if (bodyField) {
    (bodyField as HTMLElement).focus();
    document.execCommand('selectAll');
    document.execCommand('insertText', false, body);
  }
  await sleep(500);

  const sendBtnDef = findSelector('SEND_BTN', GMAIL_SELECTORS);
  let sendBtn: Element | null = null;
  for (const sel of sendBtnDef.selectors) {
    sendBtn = document.querySelector(sel);
    if (sendBtn) break;
  }
  if (sendBtn) {
    (sendBtn as HTMLElement).click();
  } else {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  }

  await waitForElementGone(toFieldDef.selectors[0], 5000);
}

function waitForElementGone(selector: string, timeout = 5000): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (!document.querySelector(selector)) { resolve(); return; }
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(); }, timeout);
  });
}

function setNativeValue(element: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ---- Bulk Email Job with Circuit Breaker ----

async function runEmailJob(contacts: Contact[], template: string, subject: string, settings: ExtensionSettings) {
  cancelRequested = false;
  const total = contacts.length;
  let sent = 0, failed = 0, consecutiveFailures = 0;

  const delayMap: Record<string, number> = { fast: 5000, normal: 10000, safe: 15000 };
  const baseDelay = settings.delayPreset === 'custom'
    ? settings.customDelaySeconds * 1000
    : (delayMap[settings.delayPreset] ?? 10000);

  for (let i = 0; i < contacts.length; i++) {
    if (cancelRequested) break;

    const contact = contacts[i];
    const to = contact.email ?? '';

    const { sent: dailySent, limit: dailyLimit } = await sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT');
    if (dailySent >= dailyLimit) {
      failed++;
      postProgress(i + 1, total, sent, failed, 'skipped', to, 'Daily limit reached');
      break;
    }

    if (!to) {
      failed++;
      postProgress(i + 1, total, sent, failed, 'skipped', to, 'No email address');
      continue;
    }

    let resolvedBody = resolveTemplate(template, contact);
    if (settings.spinSyntaxEnabled) resolvedBody = resolveSpin(resolvedBody);
    const resolvedSubject = resolveTemplate(subject, contact);

    try {
      await withRetry(() => doSend(to, resolvedSubject, resolvedBody));
      sent++;
      consecutiveFailures = 0;
      await sendToBackground('INCREMENT_COUNT', { n: 1 });
      postProgress(i + 1, total, sent, failed, 'success', to);
    } catch (err) {
      failed++;
      consecutiveFailures++;
      postProgress(i + 1, total, sent, failed, 'error', to, String(err));

      if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        window.postMessage({
          type: 'BULK_SENDER_COMPLETE', sent, failed, skipped: total - sent - failed,
          halted: true, error: `Job halted — ${consecutiveFailures} consecutive failures. Last error: ${String(err)}`,
        }, '*');
        return;
      }
    }

    if ((i + 1) % settings.batchSize === 0 && i + 1 < contacts.length) {
      postCooldown(settings.cooldownSeconds);
      await sleep(settings.cooldownSeconds * 1000);
    } else {
      const delay = settings.jitterEnabled ? applyJitter(baseDelay) : baseDelay;
      await sleep(delay);
    }
  }

  postJobComplete(sent, failed, total - sent - failed);
}

function postProgress(current: number, total: number, sent: number, failed: number, status: string, recipient: string, error?: string) {
  window.postMessage({ type: 'BULK_SENDER_PROGRESS', current, total, sent, failed, status, recipient, error }, '*');
}

function postCooldown(seconds: number) {
  window.postMessage({ type: 'BULK_SENDER_COOLDOWN', seconds }, '*');
}

function postJobComplete(sent: number, failed: number, skipped: number) {
  window.postMessage({ type: 'BULK_SENDER_COMPLETE', sent, failed, skipped }, '*');
}

// ---- Message handler from panel iframe ----

async function handlePanelMessage(event: MessageEvent) {
  const data = event.data as { type: string; [key: string]: unknown };
  if (!data || !data.type) return;

  if (data.type === 'PREFLIGHT_CHECK') {
    const result = await runPreflight(GMAIL_SELECTORS);
    postToPanel({ type: 'PREFLIGHT_RESULT', ...result });
  } else if (data.type === 'START_EMAIL_JOB') {
    const { contacts, template, subject, settings } = data as unknown as {
      contacts: Contact[]; template: string; subject: string; settings: ExtensionSettings;
    };
    runEmailJob(contacts, template, subject, settings).catch((err) => {
      postToPanel({ type: 'JOB_START_ERROR', error: String(err) });
    });
  } else if (data.type === 'CANCEL_JOB') {
    cancelRequested = true;
  }
}

// ---- Init ----
injectPanel().catch((err) => notifyError(`Failed to load on Gmail: ${String(err)}`));
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/content-gmail.ts
git commit -m "feat: Gmail content script with selector registry, retry, circuit breaker, error reporting"
```

---

### Task 6: Update Panel UI

**Files:**
- Modify: `src/panel/App.tsx`

- [ ] **Step 1: Add pre-flight state and halted job state**

At the top of the `App` component (after existing useState hooks), add:

```typescript
  const [preflight, setPreflight] = useState<{ ready: boolean; failures: string[] } | null>(null);
  const [haltedJob, setHaltedJob] = useState<{ sent: number; total: number; error: string } | null>(null);
```

- [ ] **Step 2: Add pre-flight check and halted job check on mount**

Replace the first `useEffect` (lines 46-55 of App.tsx) with:

```typescript
  useEffect(() => {
    // Load settings
    sendToBackground<ExtensionSettings>('GET_SETTINGS')
      .then(setSettings)
      .catch(() => setErrorBanner('Failed to load settings — using defaults'));

    // Load daily count
    sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT')
      .then(setDailyCount)
      .catch(() => setErrorBanner('Failed to load daily count'));

    // Load saved contacts
    loadContactsFromStorage().then((saved) => {
      if (saved && saved.length > 0) {
        setContacts(saved);
        setHeaders(Object.keys(saved[0]));
      }
    }).catch(() => setErrorBanner('Failed to load saved contacts'));

    // Check for halted WhatsApp job
    if (initialMode === 'whatsapp') {
      sendToBackground<{ status?: string; sent?: number; failed?: number; lastError?: string; contacts?: unknown[] } | null>('GET_ACTIVE_WA_JOB')
        .then((job) => {
          if (job && job.status === 'halted') {
            setHaltedJob({
              sent: job.sent ?? 0,
              total: (job.contacts as unknown[])?.length ?? 0,
              error: job.lastError ?? 'Unknown error',
            });
          }
        })
        .catch(() => {});
    }

    // Request pre-flight check from content script
    window.parent.postMessage({ type: 'PREFLIGHT_CHECK' }, '*');
  }, []);
```

- [ ] **Step 3: Add pre-flight and error message handlers to the message listener useEffect**

Replace the second `useEffect` (lines 58-99) with:

```typescript
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as { type: string; [key: string]: unknown };
      if (!data?.type) return;

      if (data.type === 'PREFLIGHT_RESULT') {
        const { ready, failures } = data as unknown as { ready: boolean; failures: string[] };
        setPreflight({ ready, failures });
      } else if (data.type === 'JOB_START_ERROR') {
        setErrorBanner(`Failed to start job: ${data.error}`);
        setStatus('idle');
      } else if (data.type === 'BULK_SENDER_PROGRESS') {
        const { current, total, sent, failed, status: st, recipient, error } = data as unknown as {
          current: number; total: number; sent: number; failed: number;
          status: string; recipient: string; error?: string;
        };
        setProgress({ current, total, sent, failed });
        setStatus('sending');
        setLogs((prev) => [...prev, {
          recipient,
          status: st as 'success' | 'error' | 'skipped',
          message: error,
        }]);
      } else if (data.type === 'BULK_SENDER_COOLDOWN') {
        const seconds = data.seconds as number;
        setStatus('cooldown');
        setCooldownRemaining(seconds);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
          setCooldownRemaining((prev) => {
            if (prev <= 1) {
              if (cooldownRef.current) clearInterval(cooldownRef.current);
              setStatus('sending');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (data.type === 'BULK_SENDER_COMPLETE') {
        const { sent, failed, skipped, halted, error } = data as unknown as {
          sent: number; failed: number; skipped: number; halted?: boolean; error?: string;
        };
        setSummary({ sent, failed, skipped });
        setStatus('completed');
        if (halted && error) {
          setErrorBanner(error);
        }
        sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT')
          .then(setDailyCount)
          .catch(() => {});
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
```

- [ ] **Step 4: Add pre-flight indicator and halted job recovery UI to the JSX**

After the error banner `div` (line 172) and before the main `<div style={{ padding: '12px 16px' ...` section, add:

```tsx
      {/* Pre-flight status */}
      {preflight && !preflight.ready && (
        <div style={{ background: '#fce8e6', color: '#c5221f', padding: '8px 16px', fontSize: '12px', borderBottom: '1px solid #e0e0e0' }}>
          <b>Blocked:</b> Cannot find: {preflight.failures.join(', ')}. The site UI may have changed — extension may need an update.
        </div>
      )}
      {preflight && preflight.ready && status === 'idle' && (
        <div style={{ background: '#e6f4ea', color: '#137333', padding: '6px 16px', fontSize: '12px', borderBottom: '1px solid #a8d5b5' }}>
          Ready to send
        </div>
      )}

      {/* Halted job recovery */}
      {haltedJob && (
        <div style={{ background: '#fef7e0', color: '#8a6d3b', padding: '10px 16px', fontSize: '12px', borderBottom: '1px solid #f0d58c' }}>
          <div style={{ marginBottom: '6px' }}>
            <b>Previous job halted</b> after sending {haltedJob.sent}/{haltedJob.total} messages.
          </div>
          <div style={{ marginBottom: '8px', fontSize: '11px' }}>Error: {haltedJob.error}</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => {
                // Resume: reset failures, set running, navigate to next contact
                sendToBackground('STORE_WA_JOB', { status: 'running', consecutiveFailures: 0, lastError: '' } as unknown as Record<string, unknown>)
                  .then(() => sendToBackground<{ contacts: { phone?: string }[]; currentIndex: number } | null>('GET_ACTIVE_WA_JOB'))
                  .then((job) => {
                    if (job) {
                      const next = job.contacts[job.currentIndex];
                      const phone = next?.phone?.replace(/[\s\-+]/g, '') ?? '';
                      if (phone) window.parent.location.href = `https://web.whatsapp.com/send?phone=${phone}`;
                    }
                    setHaltedJob(null);
                  })
                  .catch(() => setErrorBanner('Failed to resume job'));
              }}
              style={{ padding: '4px 12px', background: '#25d366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
            >
              Resume
            </button>
            <button
              onClick={() => {
                sendToBackground('CANCEL_WA_JOB', {}).catch(() => {});
                setHaltedJob(null);
              }}
              style={{ padding: '4px 12px', background: '#d93025', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Disable Send button when pre-flight fails**

In the Send button, update the `disabled` condition. Change:

```tsx
disabled={status === 'sending' || status === 'cooldown'}
```

to:

```tsx
disabled={status === 'sending' || status === 'cooldown' || (preflight !== null && !preflight.ready)}
```

- [ ] **Step 6: Replace `.catch(console.error)` on Save Settings button**

Change the Save Settings button onClick. Find:

```tsx
onClick={() => sendToBackground('SAVE_SETTINGS', settings as unknown as Record<string, unknown>).catch(console.error)}
```

Replace with:

```tsx
onClick={() => sendToBackground('SAVE_SETTINGS', settings as unknown as Record<string, unknown>).catch(() => setErrorBanner('Failed to save settings'))}
```

- [ ] **Step 7: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/panel/App.tsx
git commit -m "feat: panel UI with pre-flight indicator, halted job recovery, visible error banners"
```

---

### Task 7: Final Build + Verification

- [ ] **Step 1: Full clean build**

Run: `npm run build`
Expected: Build succeeds with all 10 output files, no errors.

- [ ] **Step 2: Verify dist output has notifications permission**

Run: `grep notifications dist/manifest.json`
Expected: Output contains `"notifications"`.

- [ ] **Step 3: Verify no remaining console.error swallowing**

Run: `grep -rn '\.catch(console' src/`
Expected: Zero matches — all silent catches replaced.

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final build verification for silent failure prevention"
```
