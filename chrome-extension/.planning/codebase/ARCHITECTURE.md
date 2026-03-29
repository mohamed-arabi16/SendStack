# Architecture

**Analysis Date:** 2026-03-29

## Pattern Overview

**Overall:** Service Worker Hub + Content Script Pair pattern with Shadow DOM UI injection

**Key Characteristics:**
- Background service worker acts as centralized message hub and state manager
- Dual content scripts (Gmail, WhatsApp) handle DOM automation independently
- Side-panel UI injected via Shadow DOM iframe in each content context
- Message-passing layer isolates business logic from platform APIs
- Persistent storage (chrome.storage) survives page navigation for WhatsApp job continuity

## Layers

**Service Worker (Background):**
- Purpose: Central orchestrator for all extension operations. Manages job state, settings persistence, daily quotas, and inter-script messaging.
- Location: `src/background.ts`
- Contains: Message handler switch statement, job state management, Chrome alarm scheduling for daily resets
- Depends on: `src/lib/storage.ts`, `src/lib/messaging.ts`
- Used by: Content scripts and UI panels via `sendToBackground()`

**Content Script Layer:**
- Gmail: `src/content-gmail.ts`
- WhatsApp: `src/content-whatsapp.ts`
- Purpose: Platform-specific DOM interaction (finding compose buttons, filling fields, triggering sends). Injects UI panel via Shadow DOM iframe. Handles user-triggered jobs.
- Depends on: `src/lib/csv-parser.ts` (template resolution, utilities), `src/lib/messaging.ts` (background communication), `src/lib/storage.ts` (types)
- Used by: Panel UI (via postMessage across iframe boundary)

**UI Layer (React):**
- Popup: `src/popup/index.tsx` + `src/popup/Popup.tsx` — small badge showing site status and daily usage
- Panel (Sidebar): `src/panel/index.tsx` + `src/panel/App.tsx` — full job control (CSV upload, template editor, settings, progress)
- Options: `src/options/index.tsx` + `src/options/Options.tsx` — persistent settings page
- Purpose: User-facing forms and progress tracking. React components with inline styles.
- Depends on: `src/lib/messaging.ts` (background service worker communication), `src/lib/csv-parser.ts` (CSV parsing, preview)
- Used by: Users via Chrome extension UI entry points

**Library Layer:**
- `src/lib/storage.ts`: TypeScript interfaces (`ExtensionSettings`, `Job`, `Contact`) + Chrome storage wrappers
- `src/lib/messaging.ts`: `sendToBackground()` — type-safe message sender
- `src/lib/csv-parser.ts`: CSV parsing (PapaParse), template resolution (`{{Variable}}`), spin syntax (`{A|B|C}`), jitter, storage utilities

## Data Flow

**Email Job Flow:**

1. User uploads CSV → Panel parses via PapaParse → stores in chrome.storage.local (24-hour TTL)
2. User clicks "Send Now" → Panel posts `START_EMAIL_JOB` message to content-gmail
3. Content-gmail runs email job loop:
   - For each contact: query daily limit from background
   - Resolve template variables and spin syntax
   - Click Compose, fill To/Subject/Body fields
   - Click Send, wait for compose to close
   - Increment daily counter via `INCREMENT_COUNT` message
   - Post progress updates back to panel via window.postMessage
   - Apply delay with optional jitter
   - Apply batch cooldown every N contacts
4. Job completes → content-gmail posts `BULK_SENDER_COMPLETE`
5. Panel shows summary, updates daily count

**WhatsApp Job Flow (Cross-Navigation):**

1. Similar CSV upload and job trigger via `START_WA_JOB`
2. Content-whatsapp stores job state (contacts, progress) in background service worker
3. Navigates to first contact's WhatsApp send URL (`web.whatsapp.com/send?phone=...`)
4. Page reloads → content-whatsapp detects `?phone=` in URL and calls `processCurrentContact()`
5. Processes current contact: fill message, click send, post progress
6. Background advances job state (`ADVANCE_WA_JOB`), returns next index
7. Navigates to next contact URL
8. Loop continues until all contacts sent or job cancelled
9. Service worker persists job state so navigations don't lose progress

**State Management:**

- **Synchronous**: Chrome extensions API (chrome.storage, chrome.runtime) — all async
- **Daily Counter**: `dailyCount` stored in chrome.storage.local with date stamp for reset detection
- **Settings**: `extensionSettings` in chrome.storage.sync (syncs across user's Chrome instances)
- **Contacts**: Loaded from CSV, stored in chrome.storage.local with 24-hour TTL
- **Job State**: In-memory for email (per-run), persistent in chrome.storage.local for WhatsApp (survives navigation)

## Key Abstractions

**Message Protocol:**

- Files: `src/lib/messaging.ts`
- Pattern: Union type `MessageAction` with payload objects; `sendToBackground<T>()` returns typed Promise
- Actions: GET/SAVE_SETTINGS, GET/INCREMENT_COUNT, START/CANCEL_JOB, STORE/ADVANCE/GET_ACTIVE_WA_JOB
- All async: `chrome.runtime.onMessage.addListener()` with `return true` to keep channel open

**Template Resolution:**

- Files: `src/lib/csv-parser.ts`
- `resolveTemplate(template, contact)` — regex-based `{{key}}` replacement, case-insensitive fallback
- `resolveSpin(template)` — regex-based `{A|B|C}` random choice
- Sanitization: strips `< >` characters from resolved variables for email safety

**Delay & Jitter:**

- `applyJitter(baseDelayMs)` — applies ±30–50% random variation (min 3 seconds)
- Used only if settings.jitterEnabled
- Batch-level cooldown: separate delay after every N contacts (no jitter)

**Storage Wrappers:**

- All chrome.storage.local/sync calls wrapped in Promises
- Keys: `extensionSettings`, `dailyCount`, `dailyDate`, `contacts`, `contactsExpiry`, `activeWaJob`
- Expiry: Contacts TTL 24h, resets on load if expired; daily count resets by date check

## Entry Points

**background.ts:**
- Location: `src/background.ts`
- Triggers: Chrome runtime on install, on alarm, on message
- Responsibilities: Initialize default settings, set up midnight alarm, route messages, manage job/quota state

**content-gmail.ts:**
- Location: `src/background.ts`
- Triggers: Injected on https://mail.google.com/* (manifest line 15–20)
- Responsibilities: Inject toggle button and shadow DOM iframe, handle email job messages, automate Gmail compose

**content-whatsapp.ts:**
- Location: `src/content-whatsapp.ts`
- Triggers: Injected on https://web.whatsapp.com/* (manifest line 21–25)
- Responsibilities: Inject toggle button and shadow DOM iframe, handle WhatsApp job messages, detect `/send?phone=` URLs, resume persisted job state

**Popup.tsx:**
- Location: `src/popup/index.tsx` + `src/popup/Popup.tsx`
- Triggers: Extension icon click (manifest action.default_popup)
- Responsibilities: Show current site status, daily usage badge, quick links to Gmail/WhatsApp

**Panel.tsx (Sidebar):**
- Location: `src/panel/index.tsx` + `src/panel/App.tsx`
- Triggers: Toggle button click in content script (injected into Gmail/WhatsApp)
- Responsibilities: CSV upload/preview, message template editor, job control, progress tracking, settings override

**Options.tsx:**
- Location: `src/options/index.tsx` + `src/options/Options.tsx`
- Triggers: Extension options page (manifest options_page)
- Responsibilities: Persistent settings form with validation

## Error Handling

**Strategy:** Try-catch with retry loops (email only), graceful degradation on Chrome API timeouts, user-facing error banners

**Patterns:**

- Email send retry: 3 attempts with 2-second delay between attempts (`src/content-gmail.ts` lines 78–86)
- Missing DOM elements: Default to keyboard shortcuts (e.g., Ctrl+Enter to send if send button not found)
- CSV parse errors: Caught in panel, shown in red error banner
- Field lookup failures: Logged but send continues (e.g., missing email address → skip contact)
- Chrome API errors: `chrome.runtime.lastError` checked in `sendToBackground()`
- Storage timeouts: Handled via Promise rejection in message handlers

## Cross-Cutting Concerns

**Logging:**
- `console.warn()`, `console.error()` for debugging
- Prefixed with `[BulkSender]` for clarity

**Validation:**
- CSV: PapaParse validates structure; extension checks for email/phone presence per contact
- Settings: Options page validates delay ≥3s, batch size ≥5
- Template: No validation; resolution is best-effort (missing keys → empty string)

**Authentication:**
- None — extension assumes Gmail/WhatsApp already authenticated in browser

**Rate Limiting:**
- Daily limit enforced per-contact in job loop (stops on limit reached)
- Delay between sends configurable (fast/normal/safe/custom)
- Batch cooldown after every N messages
- Jitter applied to base delay to avoid predictable patterns

---

*Architecture analysis: 2026-03-29*
