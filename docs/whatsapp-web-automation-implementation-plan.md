# WhatsApp Web Automation — Implementation Plan

> **🤖 Instructions for AI Agent:**
>
> Always start with the **first unchecked task** (`- [ ]`) in this plan. Work on it until all of its **success criteria** are met. Once every criterion passes, mark the task as complete (`- [x]`) and **only then** move on to the next unchecked task. Do not skip tasks or work on them out of order. If a task depends on a previous one, verify that the dependency is complete before proceeding.

---

## Phase 1 — Backend Foundation

### Task 1: Install Dependencies

- [x] **Install `whatsapp-web.js`, `qrcode`, and their type definitions**

  ```bash
  npm install whatsapp-web.js qrcode
  npm install -D @types/qrcode
  ```

  **Success Criteria:**
  - `whatsapp-web.js` and `qrcode` appear under `dependencies` in `package.json`.
  - `@types/qrcode` appears under `devDependencies` in `package.json`.
  - `npm install` completes without errors.
  - `npm ls whatsapp-web.js qrcode` resolves correctly (no `UNMET PEER DEPENDENCY` errors).

---

### Task 2: Create the WhatsApp Client Singleton Service

- [x] **Create `src/lib/whatsapp-client.ts`** — a singleton module that manages the entire WhatsApp Web session lifecycle.

  The service must expose:

  | Method / Property | Purpose |
  |---|---|
  | `initialize()` | Launch Puppeteer + WhatsApp Web, start listening for events |
  | `getQR()` | Return the latest QR code string (or `null` if already authenticated) |
  | `getStatus()` | Return current status: `disconnected` · `qr` · `ready` |
  | `sendMessage(phone, text)` | Send a text message to a phone number (E.164 format) |
  | `disconnect()` | Gracefully shut down the client and browser |

  Implementation details:
  - Use a **global variable** (`globalThis.__waClient`) to survive Next.js hot-reloads in development.
  - Use `LocalAuth` strategy for session persistence (saves to `.wwebjs_auth/`).
  - Register event handlers: `qr`, `ready`, `authenticated`, `auth_failure`, `disconnected`, `message_ack`.
  - On `qr` event, store the latest QR string so the `/api/whatsapp/qr` endpoint can serve it.
  - On `ready` event, update internal status to `ready`.
  - On `disconnected` event, reset internal status and clean up.

  **Success Criteria:**
  - The file `src/lib/whatsapp-client.ts` exists and compiles with `npx tsc --noEmit`.
  - The singleton pattern is verified: importing the module twice returns the same instance.
  - `initialize()` launches a Puppeteer-backed WhatsApp Web session.
  - `getStatus()` transitions through `disconnected → qr → ready` as the session progresses.
  - `.wwebjs_auth/` is added to `.gitignore`.

---

### Task 3: Create API Route — `POST /api/whatsapp/init`

- [x] **Create `src/app/api/whatsapp/init/route.ts`**

  - Import the singleton client from `src/lib/whatsapp-client.ts`.
  - If the client is already initialised and connected, return `{ status: 'already_connected' }`.
  - Otherwise call `initialize()` and return `{ status: 'initializing' }`.
  - Return appropriate HTTP status codes (200 on success, 500 on failure with an error message).

  **Success Criteria:**
  - `POST /api/whatsapp/init` returns JSON with a `status` field.
  - Calling the endpoint twice does **not** create two Puppeteer instances.
  - Errors during initialisation are caught and returned as `500` with a descriptive message.

---

### Task 4: Create API Route — `GET /api/whatsapp/qr`

- [x] **Create `src/app/api/whatsapp/qr/route.ts`**

  - Use the `qrcode` npm package to convert the QR string from the singleton into a base64 data URL.
  - If no QR is available (e.g., already authenticated or not yet initialised), return `{ qr: null, status: <current_status> }`.
  - Return `{ qr: 'data:image/png;base64,...', status: 'qr' }` when a QR is available.

  **Success Criteria:**
  - `GET /api/whatsapp/qr` returns JSON with `qr` and `status` fields.
  - When a QR is available, the `qr` field contains a valid base64-encoded PNG data URL.
  - When no QR is available, the `qr` field is `null` and `status` reflects the actual state.

---

### Task 5: Create API Route — `GET /api/whatsapp/status`

- [x] **Create `src/app/api/whatsapp/status/route.ts`**

  - Return the current connection status from the singleton: `disconnected`, `qr`, or `ready`.
  - Include additional info when available: connected phone number, name, etc.

  **Success Criteria:**
  - `GET /api/whatsapp/status` returns `{ status: 'disconnected' | 'qr' | 'ready' }`.
  - The status accurately reflects the real state of the WhatsApp client.

---

### Task 6: Create API Route — `POST /api/whatsapp/send`

- [x] **Create `src/app/api/whatsapp/send/route.ts`**

  Request body:
  ```json
  {
    "phone": "1234567890",
    "message": "Hello {{Name}}, ..."
  }
  ```

  - Validate that the client status is `ready` before attempting to send; return `400` otherwise.
  - Format the phone number into WhatsApp's chat ID format (`<number>@c.us`).
  - Call `client.sendMessage()` and return the result.
  - Return `{ success: true, messageId: '...' }` on success.
  - Return `{ success: false, error: '...' }` on failure.

  **Success Criteria:**
  - `POST /api/whatsapp/send` accepts JSON body with `phone` and `message`.
  - Returns `400` if the client is not connected.
  - Returns `200` with `success: true` and a `messageId` when the message is sent.
  - Returns `500` with `success: false` and an `error` message on failure.

---

### Task 7: Create API Route — `POST /api/whatsapp/disconnect`

- [x] **Create `src/app/api/whatsapp/disconnect/route.ts`**

  - Call `disconnect()` on the singleton.
  - Return `{ status: 'disconnected' }`.

  **Success Criteria:**
  - After calling this endpoint, `GET /api/whatsapp/status` returns `disconnected`.
  - Puppeteer browser process is terminated cleanly (no orphan Chromium processes).

---

## Phase 2 — Anti-Ban & Rate-Limiting System

### Task 8: Implement Custom Delay Configuration

- [x] **Add a configurable delay system for WhatsApp message sending**

  The system must support **user-selectable delay presets** and a **custom delay option**:

  | Preset | Delay Between Messages | Use Case |
  |---|---|---|
  | Fast | 5 seconds | Small list, trusted contacts |
  | Normal (default) | 10 seconds | General use |
  | Safe | 15 seconds | Large lists, unknown contacts |
  | Custom | User-defined (min 3s, max 60s) | Advanced users |

  Implementation:
  - Add a `delay` field to the `POST /api/whatsapp/send` request body (or create a bulk-send endpoint).
  - In the frontend, add a delay selector UI (dropdown or radio group) in the WhatsApp mode panel, visible when WhatsApp mode is active.
  - Store the selected delay in the component state and pass it to each send call.
  - Between each message in a bulk send loop, wait the configured delay using `await new Promise(r => setTimeout(r, delayMs))`.

  **Success Criteria:**
  - A delay selector is visible in the UI when WhatsApp mode is active.
  - The three presets (5s, 10s, 15s) are available, plus a custom input.
  - Custom delay input enforces a minimum of 3 seconds and maximum of 60 seconds.
  - The selected delay is actually respected between consecutive messages during a bulk send (verified via timestamps in the log).

---

### Task 9: Implement Randomised Delay Jitter

- [x] **Add random jitter to the delay to make sending patterns appear more human**

  Instead of sending at exact fixed intervals (e.g., exactly every 10 seconds), add a random variation:
  - Base delay = user-selected delay (e.g., 10 seconds).
  - Actual delay = `baseDelay + random(-30%, +50%)` of base delay.
  - Example for 10s base: actual delay will be between **7s and 15s**.
  - Display the actual delay used in the sending log for each message.

  **Success Criteria:**
  - Consecutive messages are NOT sent at exactly the same interval.
  - Actual delay is always within the range `[baseDelay * 0.7, baseDelay * 1.5]`.
  - The log shows the actual delay used for each message (e.g., "Waiting 11.3s before next message…").
  - Minimum actual delay never drops below 3 seconds regardless of jitter.

---

### Task 10: Implement Message Variation / Spin Syntax (Anti-Pattern-Detection)

- [x] **Add optional message spin syntax so WhatsApp doesn't flag identical messages**

  Support a simple spin syntax in message templates:
  ```
  {Hi|Hello|Hey} {{Name}}, {hope you're doing well|how are you}!
  ```

  - `{option1|option2|option3}` — randomly pick one of the options for each message.
  - This is **in addition to** the existing `{{Variable}}` template syntax (double curly braces for CSV variables).
  - Spin syntax uses **single curly braces with pipes**: `{a|b|c}`.
  - Parse and resolve spin syntax **per message** so each recipient gets a slightly different wording.
  - Display the resolved message in the log so the user can see what was actually sent.

  **Success Criteria:**
  - `{Hi|Hello|Hey}` in a template is randomly resolved to one of the three options per message.
  - Existing `{{Variable}}` syntax still works unchanged.
  - No two consecutive messages use the exact same spin resolution (probabilistically verified over 10+ messages).
  - The sending log shows the fully resolved message (both spins and variables).

---

### Task 11: Implement Batch Pausing (Cool-Down Periods)

- [x] **Add automatic cool-down pauses after every N messages**

  To mimic human behaviour and reduce ban risk:
  - After every **batch** of messages (configurable, default 10), pause for a longer period (configurable, default 60 seconds).
  - Display a countdown timer during cool-down pauses.
  - Allow the user to configure:
    - Batch size (messages before a pause): default 10, range 5–50.
    - Cool-down duration: default 60s, range 30s–300s.

  **Success Criteria:**
  - After sending `batchSize` messages, the system pauses for `coolDownDuration` seconds.
  - A countdown is visible in the UI during the cool-down period.
  - Batch size and cool-down duration are configurable in the UI.
  - The log records when a cool-down pause starts and ends.

---

### Task 12: Implement Daily Send-Limit Safeguard

- [x] **Add a daily message limit to prevent accidental mass sending that triggers bans**

  - Default daily limit: 200 messages per 24-hour rolling window.
  - Track messages sent in `localStorage` (or a lightweight server-side counter).
  - When the limit is approached (80%), show a warning banner.
  - When the limit is reached, block further sending and display a clear message.
  - Allow the user to override the limit (with a confirmation dialog warning about ban risk).

  **Success Criteria:**
  - A counter tracks messages sent in the current 24-hour window.
  - Sending is blocked when the limit is reached, with a clear UI message.
  - A warning banner appears at 80% of the limit.
  - The user can override the limit after acknowledging the risk.

---

### Task 13: Implement Number Validation Before Sending

- [x] **Validate phone numbers before attempting to send messages**

  Use `whatsapp-web.js`'s `client.isRegisteredUser(number)` method to check if a number is registered on WhatsApp before sending:
  - Before starting a bulk send, validate all numbers in the list.
  - Mark invalid numbers as "Not on WhatsApp" in the UI.
  - Skip invalid numbers during sending (don't waste time/quota on them).
  - Show a summary: "X of Y numbers are valid WhatsApp users".

  **Success Criteria:**
  - Before bulk sending, the system checks each number against WhatsApp.
  - Invalid numbers are clearly marked in the UI and skipped during sending.
  - The pre-send summary shows valid vs. invalid count.
  - Sending only attempts delivery to validated numbers.

---

## Phase 3 — Frontend Integration

### Task 14: Add QR Code Authentication UI Component

- [ ] **Add a QR code display and session management UI to `EmailDashboard.tsx`**

  When WhatsApp mode is active:
  1. Show a "Connect WhatsApp" button if status is `disconnected`.
  2. After clicking, call `POST /api/whatsapp/init` and begin polling `GET /api/whatsapp/qr`.
  3. Display the QR code image for scanning.
  4. Poll `GET /api/whatsapp/status` every 3 seconds.
  5. When status becomes `ready`, hide the QR and show a green "✅ WhatsApp Connected" badge.
  6. Show a "Disconnect" button to end the session.

  **Success Criteria:**
  - "Connect WhatsApp" button is visible when WhatsApp mode is selected and client is disconnected.
  - QR code image renders correctly and is scannable by a phone.
  - After scanning, the UI updates to show "Connected" status within 5 seconds.
  - "Disconnect" button cleanly ends the session and returns to the "Connect" state.
  - QR auto-refreshes if the previous QR expires.

---

### Task 15: Add Delay & Anti-Ban Settings UI Panel

- [ ] **Add a settings panel in the WhatsApp mode section for delay and anti-ban configuration**

  The panel should contain:
  1. **Delay Preset Selector** — Radio buttons or dropdown for Fast (5s) / Normal (10s) / Safe (15s) / Custom.
  2. **Custom Delay Input** — Number input (visible only when "Custom" is selected), range 3–60.
  3. **Batch Size** — Number input, default 10, range 5–50.
  4. **Cool-Down Duration** — Number input, default 60s, range 30–300.
  5. **Daily Limit** — Number input, default 200. Shows current count: "42 / 200 sent today".
  6. **Jitter Toggle** — Checkbox to enable/disable random delay jitter (enabled by default).
  7. **Spin Syntax Toggle** — Checkbox to enable/disable message variation processing.

  **Success Criteria:**
  - All seven controls are visible and functional in the WhatsApp mode panel.
  - Changing a preset updates the delay value correctly.
  - Custom delay input only appears when "Custom" preset is selected.
  - All numerical inputs enforce their min/max ranges.
  - Settings persist across component re-renders (stored in state).

---

### Task 16: Replace `wa.me` Link Logic with Real WhatsApp Sending

- [ ] **Modify the WhatsApp send handler in `EmailDashboard.tsx`**

  Replace the current `window.open(wa.me/...)` logic with:
  1. Check WhatsApp connection status — if not `ready`, prompt user to connect first.
  2. Loop through the CSV contacts.
  3. For each contact:
     a. Resolve template variables (`{{Name}}`, etc.).
     b. Resolve spin syntax if enabled.
     c. Call `POST /api/whatsapp/send` with the phone number and resolved message.
     d. Wait for the configured delay (with jitter if enabled).
     e. Update the sending log and progress bar.
     f. After every `batchSize` messages, trigger a cool-down pause.
  4. Handle errors gracefully — log failures but continue with the next contact.
  5. At the end, show a summary: sent, failed, skipped.

  **Success Criteria:**
  - `window.open()` is no longer called for WhatsApp sending.
  - Messages are sent via the `POST /api/whatsapp/send` API.
  - Progress bar and logs update in real time.
  - Delays and cool-down pauses are respected.
  - Failed messages are logged but don't stop the batch.
  - A final summary is displayed.

---

## Phase 4 — Session Persistence & Error Handling

### Task 17: Implement Session Persistence with `LocalAuth`

- [ ] **Ensure WhatsApp session survives server restarts**

  - Verify `LocalAuth` strategy is saving session data to `.wwebjs_auth/`.
  - On server start / client initialisation, check for an existing saved session.
  - If a valid session exists, skip QR code and reconnect automatically.
  - If the saved session is expired or invalid, fall back to QR code flow.
  - Add `.wwebjs_auth/` and `.wwebjs_cache/` to `.gitignore`.

  **Success Criteria:**
  - After scanning a QR code and connecting, restarting the dev server does **not** require re-scanning.
  - The status transitions directly from `disconnected` → `ready` on reconnect (no `qr` phase).
  - If the session file is manually deleted, the system falls back to QR code authentication.
  - `.wwebjs_auth/` is not committed to git.

---

### Task 18: Implement Robust Error Handling

- [ ] **Add comprehensive error handling for all WhatsApp operations**

  Cover these scenarios:
  1. **Client disconnects mid-send** — Detect disconnect, pause sending, show reconnect prompt.
  2. **Invalid phone number format** — Validate before sending, show clear error.
  3. **Number not on WhatsApp** — Skip and log as "Not on WhatsApp".
  4. **Rate limit hit** — Detect and automatically increase delay, warn user.
  5. **Puppeteer crash** — Catch, log, and offer restart option.
  6. **Network failure** — Retry with exponential backoff (max 3 retries).
  7. **Auth failure** — Clear saved session and prompt for re-authentication.

  **Success Criteria:**
  - Each error scenario is handled gracefully (no unhandled promise rejections or crashes).
  - Error messages in the UI are user-friendly and actionable.
  - Sending can resume after a transient error is resolved.
  - Retry logic uses exponential backoff: 5s → 10s → 20s.
  - All errors are logged with timestamps.

---

## Phase 5 — Advanced Features (Optional)

### Task 19: Add Media Sending Support

- [ ] **Enable sending images and documents alongside text messages**

  - Use `whatsapp-web.js`'s `MessageMedia` class to attach files.
  - Add an "Attach Media" button in the WhatsApp mode panel.
  - Support image types: PNG, JPG, GIF.
  - Support document types: PDF, DOCX, XLSX.
  - Max file size: 16 MB (WhatsApp limit).
  - Media is sent along with the text message (as a captioned media message).

  **Success Criteria:**
  - Users can attach a file via the UI.
  - The attached file is sent along with each message in the bulk send.
  - File type and size validations are enforced.
  - Media messages appear correctly in the recipient's WhatsApp (image with caption, or document with filename).

---

### Task 20: Add Message Delivery Status Tracking

- [ ] **Track and display delivery status for each sent message**

  Use `whatsapp-web.js`'s `message_ack` event to track:

  | ACK Value | Status |
  |---|---|
  | `0` | Pending |
  | `1` | Sent (server received) |
  | `2` | Delivered (recipient received) |
  | `3` | Read (recipient opened) |

  - Update the sending log in real time as ACK events arrive.
  - Show status icons: ⏳ Pending → ✓ Sent → ✓✓ Delivered → ✓✓ Read (blue).
  - Display a summary after sending: X sent, Y delivered, Z read.

  **Success Criteria:**
  - Each message row in the log shows a delivery status icon.
  - Status updates in real time as ACK events are received.
  - The final summary accurately counts messages by status.

---

### Task 21: Add Scheduled / Timed Sending

- [ ] **Allow users to schedule a bulk send for a specific time**

  - Add a "Schedule" option alongside the "Send Now" button.
  - Use a date-time picker to select the send time.
  - Store the scheduled job in memory (or `localStorage` for persistence).
  - At the scheduled time, trigger the bulk send automatically.
  - Show a "Scheduled for [time]" badge and a "Cancel" option.

  **Success Criteria:**
  - Users can pick a future date/time for sending.
  - The bulk send triggers at the scheduled time (within 30 seconds accuracy).
  - A scheduled job can be cancelled before it triggers.
  - The UI shows the countdown or scheduled time clearly.

---

## Summary of Anti-Ban Methods

The following methods are integrated across the tasks above to minimise the risk of a WhatsApp account ban:

| Method | Task | Description |
|---|---|---|
| **Custom Delay** | Task 8 | User-selectable delay (5s, 10s, 15s, or custom) between each message |
| **Random Jitter** | Task 9 | ±30–50% variation on delay to avoid robotic fixed-interval patterns |
| **Message Variation (Spin Syntax)** | Task 10 | Spin syntax (e.g., `{Hi or Hello or Hey}`) so no two messages are identical |
| **Batch Cool-Down** | Task 11 | Automatic 60s pause after every 10 messages (configurable) |
| **Daily Send Limit** | Task 12 | Hard cap of 200 messages/day to stay under WhatsApp's radar |
| **Number Validation** | Task 13 | Skip numbers not on WhatsApp to avoid "not found" flags |
| **Template Personalisation** | Existing | `{{Name}}` and other variables make each message unique |
| **Session Persistence** | Task 17 | Reuse sessions to avoid frequent re-authentication (which can look suspicious) |
| **Exponential Backoff on Errors** | Task 18 | Slow down automatically if errors suggest rate limiting |
