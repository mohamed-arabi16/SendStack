# External Integrations

**Analysis Date:** 2026-03-29

## APIs & External Services

**Gmail (HTTP API):**
- Integration: Direct DOM automation via content script
- Service: Google Gmail (mail.google.com)
- Purpose: Compose and send bulk emails
- No SDK required — uses native Gmail UI interaction
- Auth: Uses Gmail session (already authenticated browser tab)

**WhatsApp Web (HTTP/WebSocket):**
- Integration: Direct DOM automation via content script
- Service: WhatsApp Web (web.whatsapp.com)
- Purpose: Send bulk WhatsApp messages
- No SDK required — uses native WhatsApp Web UI interaction
- Auth: Uses WhatsApp session (already authenticated browser tab)

## Data Storage

**Storage:**
- **chrome.storage.sync** - Cross-device extension settings
  - Key: `extensionSettings` (stores `ExtensionSettings` object)
  - Provider: Chrome Sync Storage
  - Client: `chrome.storage` API (built-in)

- **chrome.storage.local** - Local device runtime state
  - Keys: `dailyCount`, `dailyDate` (daily message counter with expiry)
  - Keys: `contacts`, `contactsExpiry` (CSV contacts with 24-hour TTL)
  - Keys: `activeWaJob` (WhatsApp bulk job state across page navigations)
  - Provider: Chrome Local Storage
  - Client: `chrome.storage` API (built-in)

**File Storage:**
- CSV files: Parsed in-memory from file input (not persisted)
- Contact data: Stored in chrome.storage.local (24-hour TTL)
- Extension icons: Static assets in `/public/icons/` (bundled with extension)

**Caching:**
- Contact list: 24-hour TTL in chrome.storage.local
  - Keys: `contacts`, `contactsExpiry`
  - Location: `src/lib/csv-parser.ts` (functions: `saveContactsToStorage`, `loadContactsFromStorage`)

## Authentication & Identity

**Auth Provider:**
- None (no explicit auth service)

**Session Management:**
- User authentication happens outside the extension (Gmail/WhatsApp login)
- Extension operates within authenticated browser session
- No OAuth tokens, API keys, or credential storage
- All operations use existing page session

## Monitoring & Observability

**Error Tracking:**
- Not detected

**Logs:**
- Browser console only: `console.warn()`, `console.error()`
- Log points in: `src/lib/csv-parser.ts` (warning for large CSV files)
- No external logging service

**Metrics:**
- Internal daily counter stored in chrome.storage.local
- Progress tracking via message events between content scripts and UI

## CI/CD & Deployment

**Hosting:**
- Chrome Web Store (manual upload required)
- Extension runs locally in user's Chrome browser
- No backend service

**CI Pipeline:**
- Not detected
- Manual build required: `npm run build`

**Distribution:**
- Extension package: Generated `/dist/` directory
- Manifest V3 format in `/manifest.json`

## Environment Configuration

**Required env vars:**
- None detected

**Secrets location:**
- No external secrets
- Settings stored in chrome.storage.sync (Chrome account sync if enabled)

**Configuration files:**
- `manifest.json` - Extension permissions, entry points, host patterns
- No API keys or credentials stored

## Permissions & Host Access

**Permissions (manifest.json):**
- `storage` - Access to chrome.storage.sync and chrome.storage.local
- `alarms` - Schedule midnight reset for daily counter
- `activeTab` - Detect current tab for site-specific UI
- `scripting` - Execute scripts in tabs (reserved, not actively used)

**Host Permissions:**
- `https://mail.google.com/*` - Gmail access via content script
- `https://web.whatsapp.com/*` - WhatsApp Web access via content script

## Webhooks & Callbacks

**Incoming:**
- None (extension does not expose webhooks)

**Outgoing:**
- None (extension does not call external webhooks)

**Event Flow:**
- Message passing via `chrome.runtime.sendMessage` between background worker and content scripts
- Window messaging via `window.postMessage` between content scripts and iframe panels

## Message Passing Architecture

**Chrome Runtime Messages:**
- Background service worker: `src/background.ts`
- Content scripts: `src/content-gmail.ts`, `src/content-whatsapp.ts`
- Handler: `handleMessage()` in `src/background.ts`
- Message types: Settings CRUD, daily count tracking, job state management

**Window Messages (Cross-Frame):**
- Content script ↔ Panel iframe (same-origin via iframe)
- Types: Job start/cancel, progress updates, cooldown notifications
- Implementation: `window.addEventListener('message', handlePanelMessage)` in content scripts

---

*Integration audit: 2026-03-29*
