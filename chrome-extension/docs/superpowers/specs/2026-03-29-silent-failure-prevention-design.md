# Silent Failure Prevention — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Approach:** Selector Health Check + Circuit Breaker (Approach A with fallback selectors from B)

## Problem

The extension has 15+ places where errors go to `console.error`/`console.warn` — invisible unless DevTools is open. If WhatsApp changes a DOM selector, the extension fails silently: no error shown, messages not sent, user unaware.

## Goals

1. No error should ever be swallowed into console only
2. Broken selectors detected before a job starts (pre-flight)
3. Systemic failures during a job halt it early (circuit breaker)
4. Errors visible even when the panel isn't on screen (Chrome notifications)
5. Halted jobs recoverable across page navigations

## Non-Goals

- Auto-recovery / selector learning (too complex for now)
- Full event stream logging (overkill for current scale)
- Gmail compose pre-flight (would require opening compose window just to check)

---

## 1. Selector Registry with Fallbacks

### New file: `src/lib/selectors.ts`

A single source of truth for all DOM selectors, with ordered fallback chains.

**WhatsApp selectors:**

| Name | Fallbacks (tried in order) | Critical for pre-flight |
|------|---------------------------|------------------------|
| `CHAT_LIST` | `#pane-side`, `[data-testid="chat-list"]` | Yes |
| `MSG_INPUT` | `footer [contenteditable="true"]`, `[data-testid="conversation-compose-box-input"]` | Yes |
| `SEND_BUTTON` | `[data-testid="send"]`, `[aria-label="Send"]`, `footer button[aria-label]` | No (checked during send) |
| `INVALID_PHONE` | `[data-testid="intro-text"]` | No |

**Gmail selectors:**

| Name | Fallbacks (tried in order) | Critical for pre-flight |
|------|---------------------------|------------------------|
| `NAV` | `[role="navigation"]` | Yes |
| `COMPOSE_BTN` | `[gh="cm"]` | Yes |
| `TO_FIELD` | `[role="dialog"] [name="to"]` | No (checked during send) |
| `SUBJECT` | `[name="subjectbox"]` | No |
| `BODY` | `[role="textbox"][aria-label]` | No |
| `SEND_BTN` | `[data-tooltip*="Send"]`, `[aria-label*="Send"]` | No |

**Shared `findElement(selectorList, timeout)` function:**
- Tries each selector in the fallback chain
- Returns the first match
- If all fail after timeout, throws `SelectorError` with the selector name
- `SelectorError` is a custom Error subclass with a `selectorName` property for programmatic handling

---

## 2. Pre-flight Health Check

Runs when the panel opens — not when Send is clicked.

**Flow:**
1. Panel sends `PREFLIGHT_CHECK` message to content script on mount (via `window.parent.postMessage`)
2. Content script tries each critical selector with a short 3s timeout
3. Returns `{ ready: boolean, failures: string[] }` to the panel
4. Panel displays result:
   - All pass: green "Ready to send" indicator at top of panel
   - Any fail: red banner listing what's broken. Send button **disabled**.

**Message types:**
- Panel to content script: `{ type: 'PREFLIGHT_CHECK' }`
- Content script to panel (via iframe postMessage): `{ type: 'PREFLIGHT_RESULT', ready: boolean, failures: string[] }`

**WhatsApp critical selectors:** `CHAT_LIST`, `MSG_INPUT`
**Gmail critical selectors:** `NAV`, `COMPOSE_BTN`

---

## 3. Circuit Breaker + Retry Logic

### Per-contact retry

- Each contact gets **2 retry attempts** with 3s backoff between retries
- Retries happen on the current page (re-attempt to find the selector), NOT by re-navigating
- Only retries on `SelectorError` or timeout errors
- Does NOT retry on legitimate skips (phone not on WhatsApp, empty email, daily limit)
- After 2 retries fail, mark contact as `failed`, move to next

### Circuit breaker

- Tracks consecutive failures across contacts
- Resets to 0 on any successful send
- **Threshold: 3 consecutive failures triggers job halt**
- On halt:
  - Job status set to `halted`
  - `lastError` field populated with the failure message
  - Background worker fires a Chrome notification
  - Panel shows recovery UI on next open

**Why 3:** One failure = flaky page load. Two = slow connection. Three consecutive = systemic (broken selector, WhatsApp blocking, network down).

### State changes to `WaJobState`

```typescript
export interface WaJobState {
  jobId: string;
  contacts: Contact[];
  template: string;
  settings: ExtensionSettings;
  currentIndex: number;
  sent: number;
  failed: number;
  status: 'running' | 'cancelled' | 'completed' | 'halted';  // added 'halted'
  consecutiveFailures: number;  // new
  lastError: string;            // new
}
```

### Circuit breaker logic (in content script)

```
try send → success:
  consecutiveFailures = 0
  sent++

try send → fail (after retries):
  consecutiveFailures++
  failed++
  if consecutiveFailures >= 3:
    job.status = 'halted'
    job.lastError = error.message
    store job → background fires notification
    STOP processing
```

---

## 4. Error Surfacing — Three Tiers

### Tier 1: Panel Error Banner

For errors during active use when the panel is visible.

**What routes here:**
- Pre-flight failures → "WhatsApp UI changed — cannot find: [list]. Extension may need an update."
- Settings load failure → "Failed to load settings — using defaults"
- Daily count load failure → "Failed to load daily count"
- CSV parse errors → already handled (no change)
- Job halt → "Job stopped — 3 contacts failed in a row. [last error]. Check WhatsApp Web is working normally."

**Behavior:** Persistent (no auto-dismiss), red background, dismiss button, includes specific error text.

### Tier 2: Chrome Notifications

For errors when the panel isn't visible (WhatsApp navigation-based flow destroys the panel).

**What routes here:**
- Circuit breaker triggers during WhatsApp bulk send
- Content script fails to inject (`injectPanel()` throws)
- iframe fails to load (`iframe.onerror`)

**Implementation:**
- Background worker exposes `FIRE_NOTIFICATION` message action
- Content script sends notification request to background
- Background calls `chrome.notifications.create()`
- Requires adding `"notifications"` to manifest permissions

**Notification format:**
- Title: "Bulk Sender"
- Message: "[specific error]"
- Examples:
  - "Job halted after 47/200 — Send button not found on WhatsApp"
  - "Failed to load on WhatsApp Web — extension may need an update"

### Tier 3: Job Status Persistence

For errors that need to survive page reloads and be shown later.

**What routes here:**
- Halted jobs (already in `chrome.storage.local` via `WaJobState`)

**Panel recovery UI:**
On mount, panel checks for existing halted/failed jobs. If found:
- Shows banner: "Your last job was halted after sending [X]/[Y] messages. Error: [lastError]"
- Two buttons: "Resume" (continue from where it stopped) | "Discard" (clear the job)

### Replacement map

| Current code | Replacement |
|---|---|
| `.catch(console.error)` on settings load | Panel error banner |
| `.catch(console.error)` on daily count load | Panel error banner |
| `console.warn` on element not found | Pre-flight check result |
| `injectPanel().catch(console.error)` | Chrome notification via background |
| Silent iframe load failure | `iframe.onerror` → Chrome notification via background |
| `.catch(console.error)` on save settings | Panel error banner: "Failed to save" |
| `startWaJob().catch(console.error)` | Panel error banner |

---

## 5. Files Changed

### New files
- `src/lib/selectors.ts` — selector registry, `findElement()`, `SelectorError` class
- `src/lib/circuit-breaker.ts` — consecutive failure tracker, threshold check, reset

### Modified files
- `manifest.json` — add `"notifications"` permission
- `src/content-whatsapp.ts` — use selector registry, add pre-flight handler, add retry logic, replace all silent catches with error reporting
- `src/content-gmail.ts` — same treatment (selector registry, pre-flight, error reporting)
- `src/background.ts` — add `FIRE_NOTIFICATION` handler, handle `halted` status, add `HALT_WA_JOB` action
- `src/panel/App.tsx` — send pre-flight on mount, show ready/not-ready indicator, show halted job recovery UI, replace all `.catch(console.error)` with `setErrorBanner()`

### Unchanged files
- `src/lib/storage.ts` — no changes needed
- `src/lib/messaging.ts` — no changes needed
- `src/lib/csv-parser.ts` — no changes needed

---

## 6. Data Flows

### Pre-flight flow
```
Panel mounts
  → postMessage({ type: 'PREFLIGHT_CHECK' }) to content script
  → content script tries critical selectors (3s timeout each)
  → postMessage({ type: 'PREFLIGHT_RESULT', ready, failures }) to panel iframe
  → Panel shows green "Ready" or red "Blocked: [failures]"
  → Send button enabled/disabled accordingly
```

### Failure during send flow
```
findElement() fails on all fallbacks
  → throws SelectorError('SEND_BUTTON')
  → retry attempt 1 (3s backoff)
  → retry attempt 2 (3s backoff)
  → still fails → contact marked failed
  → consecutiveFailures++ → stored in WaJobState
  → if >= 3:
      job.status = 'halted'
      job.lastError = 'SEND_BUTTON not found'
      → background fires chrome.notification
      → next panel open shows recovery banner
  → if < 3:
      → navigate to next contact
```
