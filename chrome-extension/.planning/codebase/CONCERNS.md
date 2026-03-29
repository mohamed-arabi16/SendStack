# Codebase Concerns

**Analysis Date:** 2026-03-29

## Tech Debt

**DOM Manipulation via `document.execCommand` (Deprecated):**
- Issue: `document.execCommand()` is deprecated and unreliable. Used for composing both Gmail and WhatsApp messages.
- Files: `src/content-gmail.ts:122-123`, `src/content-whatsapp.ts:165`
- Impact: May fail silently in future Chrome versions. Email/WhatsApp composition may break without warning.
- Fix approach: Replace with modern ContentEditable APIs or direct text insertion after stabilizing element selection. Test thoroughly in staging.

**Fragile Element Selectors:**
- Issue: Selectors like `[role="dialog"] [name="to"]`, `[data-tooltip="Send "]`, `[role="textbox"][aria-label]` are brittle and depend on Gmail/WhatsApp DOM structure.
- Files: `src/content-gmail.ts:99, 109, 118, 130`, `src/content-whatsapp.ts:156, 169`
- Impact: Any Gmail or WhatsApp UI redesign will break send functionality immediately. No fallback mechanism beyond a single retry.
- Fix approach: Build abstraction layer to detect and cache selectors. Implement graceful degradation with user notification on selector failure. Add e2e test monitoring for DOM changes.

**Untyped Message Passing:**
- Issue: `postMessage` calls use `window.postMessage({ type: 'ACTION', ... }, '*')` with weak type safety. IFrame communication relies on `event.data` casts.
- Files: `src/content-gmail.ts:226`, `src/content-whatsapp.ts:94-99`, `src/panel/App.tsx:60, 136-139`
- Impact: Runtime errors if message format changes. Silent failures if panel iframe doesn't receive expected fields.
- Fix approach: Create shared types for all postMessage events. Export from `lib/messaging.ts`. Validate message shape in handlers.

**Inline Styling Throughout Panel Component:**
- Issue: `src/panel/App.tsx:150+` contains ~200 lines of inline CSS strings scattered throughout JSX.
- Impact: Difficult to maintain, no reusable styles, poor readability. Makes refactoring risky.
- Fix approach: Extract to CSS module or Tailwind. Create reusable style objects for buttons, sections, colors.

## Known Bugs

**Race Condition in WhatsApp Job State Recovery:**
- Symptoms: If browser crashes mid-job, `_activeWaJob` state in `background.ts` is lost. On restart, job cannot resume—user must restart manually.
- Files: `src/background.ts:24, 26-40`, `src/content-whatsapp.ts:79`
- Trigger: Browser restart or extension reload while WhatsApp job is running.
- Workaround: None. Job is lost.

**`nextMidnight()` Calculates Wrong Time:**
- Symptoms: Daily counter resets at 24:00 on the wrong date due to timezone confusion.
- Files: `src/background.ts:94-99`
- Trigger: Any non-UTC timezone. `setHours(24, ...)` is equivalent to `setHours(0, ...)` the next day, ignoring local timezone.
- Fix approach: Use `new Date().toLocaleDateString()` for today's date string, then calculate midnight of next day in milliseconds correctly.

**CSV Large File Upload Warnings Are Informational Only:**
- Symptoms: Parser warns at 5000 contacts but does not block upload. User can upload 10MB+ files, hitting Chrome storage limits.
- Files: `src/lib/csv-parser.ts:32-34`, `src/panel/App.tsx:106`
- Trigger: Upload CSV with >5000 rows.
- Workaround: Manually split CSV before upload.

**Error Banner Does Not Persist Across Tab Switch:**
- Symptoms: If user closes panel or switches tabs while error banner is displayed, banner state is lost in memory.
- Files: `src/panel/App.tsx:41, 167-172`
- Trigger: Panel unmounts before error is dismissed.

## Security Considerations

**Message Postback Uses `postMessage(..., '*')`:**
- Risk: Any malicious iframe or page script can intercept/spoof messages. No origin validation.
- Files: `src/content-gmail.ts:226, 230, 234`, `src/content-whatsapp.ts:94-99, 110-113, 127`, `src/panel/App.tsx:136, 138, 143`
- Current mitigation: Extension content scripts run in isolated context. Panel iframe is loaded from `chrome-extension://` (same origin). Limited exposure.
- Recommendations: Specify target origin in all `postMessage` calls: `window.parent.postMessage({...}, chrome.runtime.getURL('/'))`. Validate origin in listeners.

**DOMPurify Usage is Incomplete:**
- Risk: `DOMPurify.sanitize()` is used only in panel preview, not in content scripts. If spin syntax or template resolution is user-controlled, XSS possible.
- Files: `src/panel/App.tsx:124`, but not in `src/lib/csv-parser.ts:66-72`
- Current mitigation: Template is author-controlled in panel. CSV data is sanitized only in preview.
- Recommendations: Apply `DOMPurify.sanitize()` to resolved template in `resolveTemplate()` before returning. Treat all user/CSV data as untrusted.

**No CSP Headers on Extension Pages:**
- Risk: `manifest.json` has minimal CSP. Inline scripts and event handlers are allowed.
- Files: `manifest.json:41-43`
- Impact: Reduces protection against injected scripts if attacker can compromise an iframe.
- Recommendations: Strengthen CSP to `script-src 'self'` only (no inline scripts). Move all inline event handlers to separate JS.

**Phone Number Normalization Strips `+` Globally:**
- Risk: Phone numbers are normalized by removing `+`, spaces, dashes. This is correct for WhatsApp API but exposes a potential injection point if regex is mishandled.
- Files: `src/lib/csv-parser.ts:28, 148`, `src/content-whatsapp.ts:204`
- Current mitigation: Regex is safe (`/[\s\-+]/g`). Only used for WhatsApp phone URLs which are structure-validated by WhatsApp.
- Recommendations: Continue to validate that normalized phone contains only digits before constructing `send?phone=` URL.

## Performance Bottlenecks

**Synchronous CSV Parsing Blocks UI:**
- Problem: Large CSV files are parsed synchronously in the browser main thread.
- Files: `src/lib/csv-parser.ts:14-40`, called from `src/panel/App.tsx:101-111`
- Cause: `Papa.parse()` is synchronous. No web worker used.
- Improvement path: Move CSV parsing to a web worker. Show progress bar during parse. Implement chunked parsing for >10MB files.

**Panel Renders All 320 Lines at Once:**
- Problem: `src/panel/App.tsx` is a single 320-line component with multiple sections (upload, template, settings, progress, logs).
- Impact: Even with small changes (e.g., progress update), entire component rerenders.
- Improvement path: Extract sections into separate components (`<UploadSection>`, `<SettingsSection>`, etc.). Use React.memo() to prevent unnecessary rerenders.

**Mutation Observer in `waitForElement()` Never Cleans Up on Early Exit:**
- Problem: If element is not found within timeout, observer is disconnected but query is still polling.
- Files: `src/content-gmail.ts:11-22`, `src/content-whatsapp.ts:10-21`
- Impact: Memory leak if `waitForElement` is called repeatedly with unrealistic timeouts.
- Improvement path: Add early cleanup flag. Verify observer is only registered once per selector.

**Interval Cooldown Timer Keeps Running if Component Unmounts:**
- Problem: `cooldownRef.current` in panel may not clear if component unmounts during cooldown.
- Files: `src/panel/App.tsx:43, 79-89, 145`
- Impact: Minor—interval is cleared on mount next time, but wastes CPU.
- Improvement path: Ensure `clearInterval` is called in cleanup function if component unmounts.

## Fragile Areas

**Content Script Job Execution (`content-gmail.ts` and `content-whatsapp.ts`):**
- Files: `src/content-gmail.ts:168-223`, `src/content-whatsapp.ts:78-151`
- Why fragile: Jobs loop through contacts with minimal error recovery. If a single compose fails, entire loop is aborted. No retry logic or failure recovery.
- Safe modification: Add configurable retry count. Implement exponential backoff for compose timeouts. Log failures granularly.
- Test coverage: E2E tests cover happy path (3 contacts, all sent). Missing: network timeouts, Gmail/WhatsApp UI changes mid-job, user cancellation during retry.

**Background Service Worker Message Router (`background.ts:102-154`):**
- Files: `src/background.ts:102-154`
- Why fragile: Switch statement with string action names. No validation that payload matches expected action. Type casting is unsafe (`message.payload as unknown as Type`).
- Safe modification: Create strict discriminated union for message types. Validate payload schema before casting.
- Test coverage: No unit tests for background message handlers.

**WhatsApp Job State Serialization:**
- Files: `src/background.ts:26-51`, `src/content-whatsapp.ts:195-208`
- Why fragile: Job state is stored in `chrome.storage.local` as JSON. If settings or contact schema changes, deserialized state may be incompatible.
- Safe modification: Add version field to job state. Implement migration for schema changes.

**Settings Persistence Across Service Worker Restarts:**
- Files: `src/lib/storage.ts:37-81`, `src/background.ts:61-81`
- Why fragile: Settings loaded from `chrome.storage.sync` on every message. If sync service delays, settings may be stale.
- Safe modification: Cache settings in background worker. Invalidate on 'SAVE_SETTINGS' message only.

## Scaling Limits

**Chrome Storage Limits:**
- Current capacity: 10 MB for `chrome.storage.local` per extension.
- Limit: CSV with >20,000 contacts (~5MB) + job state + settings = approaching limit.
- Scaling path: Implement IndexedDB for contacts instead of chrome.storage. Or: split contact lists into chunks; delete old contacts after TTL.

**Single Background Service Worker:**
- Current capacity: One job queue per extension instance.
- Limit: If multiple tabs start jobs simultaneously, only one context is active. Second job overwrites first.
- Scaling path: Not an issue for v1 (single-user Chrome extension). If multi-user, switch to Manifest V3 persistent storage or implement job queue.

**Delay Configuration Minimum is 3 Seconds:**
- Current: `src/panel/App.tsx:243` enforces min 3s custom delay.
- Risk: Too aggressive sends (e.g., <1s) trigger Gmail/WhatsApp rate limits. Extension provides no adaptive throttling.
- Recommendation: Keep 3s minimum. Monitor send failures for rate-limit errors. Implement auto-backoff if consecutive failures detected.

## Dependencies at Risk

**DOMPurify (^3.2.5):**
- Risk: No automated security updates. If 0-day XSS bypass is found, users won't be protected until they manually reinstall.
- Impact: Panel preview could be exploited if attacker controls template.
- Migration plan: None needed short-term, but recommend pinning to exact version and monitoring security advisories.

**PapaParse (^5.5.3):**
- Risk: CSV parsing library unmaintained for 2+ years. May not handle edge cases in CSV spec.
- Impact: Malformed CSV files could fail to parse or parse incorrectly.
- Migration plan: Replace with lightweight built-in CSV parser for simple key-value format, or switch to newer library (e.g., `csv-parse`).

**React ^19.1.0 & React-DOM ^19.1.0:**
- Risk: React 19 is very recent. May have edge cases or performance issues not yet discovered.
- Impact: Panel could be unstable in some browser conditions.
- Recommendation: Monitor React issue tracker. Pin to 19.1.0 until 19.2+ proves stable. Consider reverting to 18 if issues arise.

**Vite 6.3.1:**
- Risk: Very new build tool version. May have undocumented breaking changes in future 6.x releases.
- Impact: Build could fail unexpectedly after `npm install --save`.
- Recommendation: Pin to 6.3.1 exactly until next major version is reviewed.

## Missing Critical Features

**No Undo / Job Cancellation Confirmation:**
- Problem: User can cancel mid-job by clicking "Cancel" button. No confirmation, no reversal of already-sent messages.
- Blocks: Users cannot recover from accidental job start.
- Fix: Add confirmation modal before cancellation. Clarify: "This stops sending new messages, but already-sent ones cannot be unsent."

**No Duplicate Detection in CSV:**
- Problem: If CSV has duplicate email addresses, extension sends to same recipient multiple times.
- Blocks: Users cannot deduplicate before upload.
- Fix: Add optional "Deduplicate by email" checkbox. Warn on duplicates.

**No Pause/Resume for Jobs:**
- Problem: If job is interrupted (page reload, browser crash), it cannot resume from last contact.
- Blocks: Users must restart entire job.
- Fix: Store job progress in `chrome.storage.local`. On page reload, resume from `currentIndex`.

**No Rate-Limit Detection:**
- Problem: If Gmail or WhatsApp rate-limits sender, extension keeps sending until daily limit is hit. No backoff.
- Blocks: Large jobs may hit rate limits without user knowing.
- Fix: Detect error messages like "too many requests". Automatically increase delays or pause.

## Test Coverage Gaps

**No Unit Tests for Background Message Handler:**
- What's not tested: `background.ts:handleMessage()` — job state updates, settings save/load, daily count logic.
- Files: `src/background.ts:107-154`
- Risk: Any change to message routing could break silently. No validation of payload types.
- Priority: **High** — background worker is core to all operations.

**No Error Path E2E Tests:**
- What's not tested: Network timeouts, invalid email/phone format, Gmail/WhatsApp UI element not found, rate limiting.
- Files: All content scripts
- Risk: Errors discovered only by users in production.
- Priority: **High** — error handling is mission-critical.

**No Memory Leak Tests:**
- What's not tested: Long-running jobs (1000+ contacts) don't leak memory. Mutation observers clean up.
- Risk: Extension becomes slow/unresponsive after several large sends.
- Priority: **Medium** — only affects power users.

**No Tests for Settings Persistence Across Service Worker Restart:**
- What's not tested: If background worker restarts mid-job, settings are still available.
- Files: `src/lib/storage.ts`, `src/background.ts:61-81`
- Risk: Settings could be lost on service worker reload.
- Priority: **Medium** — service workers restart infrequently, but job state would be lost.

**CSV Parser Edge Cases Not Covered:**
- What's not tested: Empty CSV, CSV with no email/phone column, malformed headers, extremely long field values.
- Files: `src/lib/csv-parser.ts`
- Risk: Silent failures or parser crashes.
- Priority: **Low** — simple file, but validation would improve robustness.

---

*Concerns audit: 2026-03-29*
