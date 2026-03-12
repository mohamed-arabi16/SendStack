# Bulk Email & WhatsApp Sender — Chrome Extension Plan

> **🤖 Instructions for AI Agent:**
>
> Always start with the **first unchecked task** (`- [ ]`) in this plan. Work on it until all of its **success criteria** are met. Once every criterion passes, mark the task as complete (`- [x]`) and **only then** move on to the next unchecked task. Do not skip tasks or work on them out of order. If a task depends on a previous one, verify that the dependency is complete before proceeding.

---

## Overview

A Chrome Extension version of the Bulk Email & WhatsApp Sender that runs entirely inside the browser — no server required. The extension injects a sidebar panel into Gmail and WhatsApp Web, reads CSV contacts from local files, sends bulk emails via the Gmail Compose API, and automates WhatsApp messages through the WhatsApp Web UI.

### Architecture at a Glance

| Layer | Technology | Responsibility |
|---|---|---|
| **Manifest** | `manifest.json` (MV3) | Declares permissions, service worker, content scripts |
| **Service Worker** | `background.ts` | Long-lived logic, alarms, cross-tab messaging |
| **Content Script — Gmail** | `content-gmail.ts` | Injects sidebar into `mail.google.com`, sends via Compose UI |
| **Content Script — WhatsApp** | `content-whatsapp.ts` | Injects sidebar into `web.whatsapp.com`, automates message UI |
| **Sidebar Panel** | `panel/` (React + Tailwind) | Shared UI for CSV upload, template editor, settings |
| **Options Page** | `options/` (React) | Persistent settings: SMTP fallback, daily limits, defaults |
| **Storage** | `chrome.storage.sync` | User settings; `chrome.storage.local` for CSV data and logs |

---

## Phase 1 — Extension Scaffold

### Task 1: Create the Extension Manifest and Build Pipeline

- [x] **Set up `manifest.json` (Manifest V3) and a Webpack/Vite build pipeline**

  The extension must be built as a standard Chrome MV3 extension. The build output
  goes into a `chrome-extension/dist/` folder that can be loaded unpacked in Chrome.

  `manifest.json` must declare:
  - `manifest_version: 3`
  - `name`, `version`, `description`, `icons`
  - `background.service_worker` pointing to the compiled service worker
  - `content_scripts` for `https://mail.google.com/*` and `https://web.whatsapp.com/*`
  - `action` with a default popup (`popup.html`)
  - `options_page` pointing to `options.html`
  - `permissions`: `storage`, `alarms`, `tabs`, `scripting`, `identity`
  - `host_permissions`: `https://mail.google.com/*`, `https://web.whatsapp.com/*`

  Build pipeline:
  - Use **Vite** with the `@crxjs/vite-plugin` (or Webpack with `copy-webpack-plugin`).
  - Entry points: `background.ts`, `content-gmail.ts`, `content-whatsapp.ts`, `popup/index.tsx`, `panel/index.tsx`, `options/index.tsx`.
  - Tailwind CSS via PostCSS for the panel and options pages.
  - TypeScript strict mode throughout.

  Folder structure:
  ```
  chrome-extension/
  ├── manifest.json
  ├── src/
  │   ├── background.ts
  │   ├── content-gmail.ts
  │   ├── content-whatsapp.ts
  │   ├── panel/
  │   │   ├── index.tsx        # React root for sidebar panel
  │   │   ├── App.tsx
  │   │   └── components/
  │   ├── popup/
  │   │   ├── index.tsx        # React root for toolbar popup
  │   │   └── Popup.tsx
  │   ├── options/
  │   │   ├── index.tsx        # React root for options page
  │   │   └── Options.tsx
  │   └── lib/
  │       ├── storage.ts       # chrome.storage helpers
  │       ├── messaging.ts     # chrome.runtime.sendMessage helpers
  │       └── csv-parser.ts    # Reuse papaparse CSV logic
  ├── public/
  │   ├── icons/
  │   │   ├── icon16.png
  │   │   ├── icon48.png
  │   │   └── icon128.png
  │   └── panel.html           # HTML shell for the injected panel
  ├── vite.config.ts
  ├── tsconfig.json
  └── package.json
  ```

  **Success Criteria:**
  - Running `npm run build` inside `chrome-extension/` produces a `dist/` folder.
  - Loading `dist/` as an unpacked extension in `chrome://extensions` shows no errors.
  - The extension icon appears in the Chrome toolbar.
  - No TypeScript errors (`npx tsc --noEmit`).
  - `chrome-extension/dist/` is listed in the root `.gitignore`.

---

### Task 2: Implement the Service Worker (Background Script)

- [x] **Create `src/background.ts`** — the persistent service worker that coordinates all extension logic.

  Responsibilities:
  - Listen for `chrome.runtime.onInstalled` to set default settings in `chrome.storage.sync`.
  - Expose a message-passing API that content scripts and the panel call via `chrome.runtime.sendMessage`.
  - Manage daily send counters using `chrome.alarms` (reset at midnight).
  - Keep track of active sending jobs so they survive popup close.
  - Relay progress events back to the panel via `chrome.tabs.sendMessage`.

  Message types the service worker must handle:

  | Message Action | Payload | Response |
  |---|---|---|
  | `GET_SETTINGS` | — | Current settings object |
  | `SAVE_SETTINGS` | `{ settings }` | `{ ok: true }` |
  | `GET_DAILY_COUNT` | — | `{ sent: number, limit: number }` |
  | `INCREMENT_COUNT` | `{ n: number }` | `{ newTotal: number }` |
  | `RESET_COUNT` | — | `{ ok: true }` |
  | `START_JOB` | `{ jobId, contacts, template, mode }` | `{ ok: true }` |
  | `CANCEL_JOB` | `{ jobId }` | `{ ok: true }` |

  **Success Criteria:**
  - Service worker registers without errors in `chrome://extensions`.
  - `GET_SETTINGS` / `SAVE_SETTINGS` round-trip correctly through `chrome.storage.sync`.
  - Daily counter resets at midnight via an alarm.
  - Sending a `START_JOB` message stores the job and returns `{ ok: true }`.

---

## Phase 2 — Gmail Integration

### Task 3: Create the Gmail Content Script

- [x] **Create `src/content-gmail.ts`** — injected into `mail.google.com` to add the sidebar panel.

  The content script must:
  1. Detect when Gmail has fully loaded (wait for the compose toolbar or inbox to appear).
  2. Create a shadow DOM container and inject the React sidebar panel (`panel/index.tsx`) into it.
  3. Add a floating toggle button (pinned to the right edge of the viewport) to show/hide the panel.
  4. Expose a `sendViaGmailCompose(to, subject, body)` function that:
     - Opens Gmail's compose window via the keyboard shortcut `C` or by clicking the Compose button.
     - Fills in the `To`, `Subject`, and body fields using `document.execCommand` / `input` events.
     - Clicks the Send button.
     - Waits for the compose window to close before resolving.
  5. Listen for `SEND_EMAIL` messages from the panel and call `sendViaGmailCompose`.

  **Success Criteria:**
  - Navigating to `mail.google.com` shows the toggle button on the right side.
  - Clicking the toggle button opens/closes the sidebar panel.
  - The panel renders correctly with no console errors.
  - Sending a test message via the panel opens Gmail compose, fills the fields, and sends.
  - Shadow DOM prevents Gmail's CSS from leaking into the panel.

---

### Task 4: Implement Bulk Email Sending via Gmail Compose

- [x] **Add bulk email logic to the Gmail content script**

  The bulk email flow:
  1. Panel sends `START_EMAIL_JOB` message to the content script with contacts and template.
  2. Content script loops over contacts:
     a. Resolves `{{Variable}}` template placeholders.
     b. Calls `sendViaGmailCompose(to, subject, resolvedBody)`.
     c. Waits for the configured delay (with jitter).
     d. Updates progress by posting `PROGRESS` events back to the panel.
     e. After every `batchSize` messages, waits for the cool-down duration.
  3. On completion, posts a `JOB_COMPLETE` event with a summary.

  Error handling:
  - If Gmail compose fails to open within 5 seconds, retry up to 3 times.
  - If a recipient address is invalid (Gmail shows an error), mark as failed and continue.
  - If the user is not logged in to Gmail, show an actionable error in the panel.

  **Success Criteria:**
  - Bulk email starts when the user clicks "Send" in the panel (Gmail mode).
  - Each recipient receives a personalised email with resolved template variables.
  - Progress bar and log update in real time.
  - Delays, jitter, and batch cool-downs are respected.
  - Failed sends are logged without stopping the batch.
  - A final summary (sent / failed / skipped) is displayed.

---

## Phase 3 — WhatsApp Web Integration

### Task 5: Create the WhatsApp Web Content Script

- [x] **Create `src/content-whatsapp.ts`** — injected into `web.whatsapp.com` to automate messaging.

  The content script must:
  1. Detect when WhatsApp Web has fully loaded (wait for the chat list to appear).
  2. Create a shadow DOM container and inject the React sidebar panel into it.
  3. Add a floating toggle button to show/hide the panel (same UX pattern as Gmail).
  4. Expose a `sendViaWhatsAppWeb(phone, message)` function that:
     - Opens a chat with the given phone number by navigating to `https://web.whatsapp.com/send?phone=<number>`.
     - Waits for the chat to open and the message input to become interactive.
     - Types the message into the input field using simulated `input` events.
     - Presses Enter (or clicks the Send button) to send.
     - Verifies the message appears in the chat before resolving.
  5. Listen for `SEND_WHATSAPP` messages from the panel and call `sendViaWhatsAppWeb`.

  **Success Criteria:**
  - Navigating to `web.whatsapp.com` shows the toggle button.
  - `sendViaWhatsAppWeb('1234567890', 'Hello!')` opens the chat and sends the message.
  - Shadow DOM isolates the panel from WhatsApp Web's styles.
  - If the number is not on WhatsApp, the function rejects with a clear error.

---

### Task 6: Implement Bulk WhatsApp Sending

- [x] **Add bulk WhatsApp send logic to the WhatsApp content script**

  Mirror the Gmail bulk flow (Task 4) but for WhatsApp:
  1. Panel sends `START_WA_JOB` message to the content script.
  2. Content script loops over contacts:
     a. Resolves `{{Variable}}` and spin syntax `{A|B|C}`.
     b. Calls `sendViaWhatsAppWeb(phone, resolvedMessage)`.
     c. Waits for the configured delay (with jitter).
     d. Posts progress events back to the panel.
     e. Applies batch cool-down after every `batchSize` messages.
  3. Posts `JOB_COMPLETE` with a summary on finish.

  Anti-ban measures (same as existing server-side implementation):
  - Configurable delay presets: Fast (5s), Normal (10s), Safe (15s), Custom.
  - Random jitter: ±30-50% of base delay.
  - Batch cool-down: default 60s after every 10 messages.
  - Daily send limit: default 200, tracked in `chrome.storage.local`.
  - Spin syntax for message variation.

  **Success Criteria:**
  - Bulk WhatsApp send works end-to-end from the panel.
  - All anti-ban measures from the server-side implementation are present.
  - Numbers that are not on WhatsApp are skipped and logged.
  - Sending can be paused and resumed from the panel.
  - Progress and logs are identical in behaviour to the existing web app.

---

## Phase 4 — Shared Sidebar Panel (UI)

### Task 7: Build the Shared React Sidebar Panel

- [x] **Create `src/panel/App.tsx`** — the React component that serves as the UI for both Gmail and WhatsApp Web.

  The panel must include all the controls already present in the web app's `EmailDashboard.tsx`:

  | Section | Controls |
  |---|---|
  | **Mode Selector** | Toggle between Email and WhatsApp mode |
  | **CSV Upload** | File picker; displays parsed contacts in a table preview |
  | **Template Editor** | Multi-line textarea with `{{Variable}}` and `{Spin|Syntax}` support |
  | **Settings Panel** | Delay presets, jitter toggle, batch size, cool-down, daily limit |
  | **Send Controls** | Send Now button, Schedule button, Cancel button |
  | **Progress Panel** | Progress bar, real-time log, delivery status icons |
  | **Summary** | Sent / failed / skipped counts after completion |

  Constraints:
  - The panel must be self-contained and work inside a shadow DOM root.
  - Tailwind CSS must be injected as a `<style>` tag inside the shadow root (not via `<link>`).
  - All state must live in the panel component (no server-side state).
  - Communication with the content script uses `window.postMessage` (inside the same page).

  **Success Criteria:**
  - The panel renders correctly in both Gmail and WhatsApp Web.
  - All seven sections are present and functional.
  - CSV upload parses the file and shows a contact preview.
  - The template editor supports live variable preview (shows resolved text for first contact).
  - Tailwind styles do not conflict with the host page's styles.

---

### Task 8: Implement the Toolbar Popup

- [x] **Create `src/popup/Popup.tsx`** — the small UI shown when the extension icon is clicked.

  The popup must show:
  1. **Status indicator** — whether the user is on Gmail or WhatsApp Web, with a link to open the site.
  2. **Quick stats** — "X / Y messages sent today" from the daily counter.
  3. **Active job status** — if a send job is running, show its progress (percentage + ETA).
  4. **Quick settings** — toggle for the sidebar visibility on the current tab.
  5. **Link to Options page** — to access full settings.

  **Success Criteria:**
  - Clicking the extension icon opens the popup.
  - The popup shows correct daily send stats from `chrome.storage.local`.
  - If on Gmail or WhatsApp Web, the popup shows the correct site status.
  - "Open Options" link navigates to the options page.

---

### Task 9: Implement the Options Page

- [x] **Create `src/options/Options.tsx`** — the full-featured settings page.

  Settings to configure:

  | Setting | Type | Default | Description |
  |---|---|---|---|
  | `defaultMode` | `'email' \| 'whatsapp'` | `'email'` | Default mode when the panel opens |
  | `delayPreset` | `'fast' \| 'normal' \| 'safe' \| 'custom'` | `'normal'` | Default delay preset |
  | `customDelaySeconds` | `number` | `10` | Custom delay in seconds (3–60) |
  | `jitterEnabled` | `boolean` | `true` | Enable random delay jitter |
  | `batchSize` | `number` | `10` | Messages per batch |
  | `cooldownSeconds` | `number` | `60` | Cool-down duration between batches |
  | `dailyLimit` | `number` | `200` | Max messages per 24-hour window |
  | `spinSyntaxEnabled` | `boolean` | `true` | Enable spin syntax processing |
  | `sidebarPosition` | `'left' \| 'right'` | `'right'` | Panel position on the page |

  All settings are persisted to `chrome.storage.sync` so they sync across Chrome profiles.

  **Success Criteria:**
  - Options page opens from the popup and from `chrome://extensions`.
  - All settings save and reload correctly via `chrome.storage.sync`.
  - Changing settings on one Chrome profile propagates to another (sync verified manually).
  - Validation prevents invalid values (e.g., delay < 3s, batch size < 5).

---

## Phase 5 — CSV Handling and Storage

### Task 10: Implement In-Extension CSV Parsing and Storage

- [x] **Create `src/lib/csv-parser.ts` and integrate with `chrome.storage.local`**

  - Reuse the `papaparse` library for CSV parsing.
  - Parse the CSV in the panel (browser context) — no server call needed.
  - Store the parsed contact list in `chrome.storage.local` (key: `contacts`) with a TTL of 24 hours.
  - On panel load, restore the previously uploaded contact list if it hasn't expired.
  - Support the same column conventions as the existing web app:
    - `email` column for Email mode.
    - `phone` column for WhatsApp mode (strips `+`, spaces, and dashes).
    - Any additional column becomes a template variable.

  Storage size note: `chrome.storage.local` has a 10 MB limit. Warn the user if the CSV
  contains more than 5,000 contacts (estimated ~2 MB).

  **Success Criteria:**
  - Uploading a CSV parses it and shows a preview in the panel.
  - Contacts are restored from `chrome.storage.local` after a page reload.
  - Contacts expire after 24 hours (stale data is cleared).
  - CSVs with 1,000+ rows parse in under 2 seconds.
  - A warning is shown when the CSV exceeds 5,000 rows.

---

## Phase 6 — Permissions and Security

### Task 11: Implement Least-Privilege Permissions and Content Security Policy

- [x] **Audit and lock down the extension's permissions and CSP**

  Permissions audit:
  - Use `"activeTab"` instead of `"tabs"` wherever possible to minimise permissions.
  - Remove `"identity"` if OAuth (Gmail API) is not used in the extension version.
  - Do not request `"history"`, `"bookmarks"`, or other sensitive permissions.

  Content Security Policy (in `manifest.json`):
  ```json
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
  ```

  Input sanitization:
  - Sanitize all CSV column values before inserting into template strings to prevent DOM XSS.
  - Use `DOMPurify` for any HTML content rendered in the panel.
  - Never use `eval()` or `Function()` constructors.
  - Use `innerText` / `textContent` instead of `innerHTML` when setting user-provided content.

  **Success Criteria:**
  - The extension passes Chrome Web Store's automated security review (no `eval`, `innerHTML` with user data, or unsafe permissions).
  - All user-provided strings are sanitized before rendering.
  - The manifest declares the minimum necessary permissions.
  - `npx web-ext lint` (or equivalent) reports no warnings.

---

## Phase 7 — Testing and Publishing

### Task 12: Write End-to-End Tests for Core Flows

- [ ] **Add Playwright tests that load the unpacked extension and exercise the main flows**

  Test cases:
  1. **Gmail bulk send** — Upload a 3-row CSV, set a template, trigger send, verify 3 Gmail compose windows open and close in sequence.
  2. **WhatsApp bulk send** — Upload a 3-row CSV, trigger send, verify `sendViaWhatsAppWeb` is called for each contact.
  3. **Daily limit enforcement** — Set limit to 2, upload a 5-row CSV, verify sending stops after 2 messages.
  4. **Settings persistence** — Change delay preset, reload options page, verify setting is restored.
  5. **CSV parsing** — Upload a CSV with `{{Name}}` variable, verify the preview shows resolved text.

  ```bash
  npm run test:e2e
  ```

  **Success Criteria:**
  - All 5 test cases pass without manual intervention.
  - Tests run in CI (GitHub Actions) against a headful Chrome with `--load-extension`.
  - Each test completes in under 30 seconds.

---

### Task 13: Prepare Chrome Web Store Listing

- [ ] **Create the Chrome Web Store submission assets and listing copy**

  Required assets:
  - Store icon: 128×128 PNG.
  - Screenshots: at least 3 × 1280×800 PNG showing Gmail panel, WhatsApp panel, and options page.
  - Promotional tile: 440×280 PNG.
  - `store-listing.md` with: short description (≤132 chars), detailed description, privacy policy URL, support URL.

  Privacy policy must state:
  - No user data is transmitted to external servers.
  - CSV data is stored locally in `chrome.storage.local` only.
  - The extension does not read email content — it only opens the Gmail compose window.

  **Success Criteria:**
  - All assets meet Chrome Web Store size and format requirements.
  - The extension zip (`dist/*.zip`) is under 10 MB.
  - The listing passes Chrome Web Store's automated pre-review checks.
  - Privacy policy is hosted at a publicly accessible URL.

---

## Summary of Key Design Decisions

| Decision | Rationale |
|---|---|
| **Manifest V3** | Required for new Chrome Web Store submissions; service workers replace persistent background pages |
| **Shadow DOM for panel** | Prevents style conflicts with Gmail and WhatsApp Web's complex CSS |
| **`chrome.storage.sync` for settings** | Settings sync across Chrome profiles without a server |
| **Content script automation (no API)** | Avoids OAuth complexity and API quotas; works with any Gmail or WhatsApp account |
| **Reuse existing anti-ban logic** | Spin syntax, jitter, and batch cool-down are proven effective in the server version |
| **Papaparse for CSV** | Already a dependency in the web app; works identically in the browser |
| **No server dependency** | Extension is fully self-contained; users install and go without configuring a backend |

---

## Migration Path from Web App to Extension

For users of the existing Next.js web app who want to move to the extension:

1. Export your CSV contacts — they are compatible with the extension without modification.
2. Copy your message templates — `{{Variable}}` and `{Spin|Syntax}` syntax is identical.
3. Install the extension and open Gmail or WhatsApp Web.
4. Upload your CSV and paste your template into the panel — no re-configuration needed.

The extension and the web app can coexist. Teams that need the server-side WhatsApp automation (Puppeteer-based) should continue using the web app; the extension is recommended for individual users who prefer a lighter, no-server setup.
