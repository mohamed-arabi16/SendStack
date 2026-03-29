# Chrome Web Store — SendStack — Bulk Messaging

## Short Description (≤ 132 characters)

> SendStack: Send personalised bulk emails and WhatsApp messages from Gmail and WhatsApp Web — no server needed.

*(107 characters — within limit)*

---

## Detailed Description

**SendStack — Bulk Messaging** lets you reach hundreds of contacts straight from your browser — no backend, no API keys, no subscriptions.

### Key Features

- **Gmail bulk send** — Upload a CSV, write a template with `{{Name}}`, `{{Company}}`, or any column header, and the extension cycles through your contacts one by one using the native Gmail compose window.
- **WhatsApp bulk send** — Uses WhatsApp Web to send personalised messages to each phone number in your CSV.
- **Anti-ban safety controls** — Built-in per-message delay presets (Fast / Normal / Safe / Custom), optional random jitter, batch cool-down pauses, and a configurable daily sending limit keep your accounts safe.
- **Spin syntax** — Write `{Hello|Hi|Hey} {{Name}}!` and the extension randomly picks a variant for each recipient, making every message feel unique.
- **CSV variable substitution** — Any column in your CSV becomes a template variable. Headers are auto-detected; no mapping needed.
- **Live progress panel** — A slide-in sidebar shows sent / failed / skipped counters in real time. You can cancel mid-send at any time.
- **Fully offline** — All data stays in your browser (`chrome.storage.local`). Nothing is sent to external servers.
- **Cross-profile settings sync** — Delay preferences and limits sync automatically across your Chrome profiles via `chrome.storage.sync`.

### How It Works

1. **Install** the extension from the Chrome Web Store.
2. **Open Gmail** (or WhatsApp Web) — a small "Bulk Sender" tab appears on the right edge of the page.
3. **Upload a CSV** with `email` (or `phone`) and any personalisation columns.
4. **Write your template** — use `{{column_header}}` placeholders.
5. **Click Send** — the extension opens each compose window (or WhatsApp chat), fills in the personalised message, and sends it.

### CSV Format

```
email,Name,Company
alice@example.com,Alice,Acme Corp
bob@example.com,Bob,Widgets Ltd
```

For WhatsApp, replace (or add) a `phone` column with international-format numbers (digits only, e.g. `14155551234`).

### Permissions Used

| Permission | Why |
|---|---|
| `storage` | Save CSV data and settings locally |
| `alarms` | Reset the daily send counter at midnight |
| `tabs` | Detect current site (Gmail/WhatsApp) in popup, open new tabs |
| `notifications` | Alert user when a bulk send job halts due to errors |

The extension does **not** read your email content or message history.

### Support & Source Code

- **Support:** https://github.com/mohamed-arabi16/SendStack/issues
- **Source:** https://github.com/mohamed-arabi16/SendStack
- **Privacy Policy:** https://github.com/mohamed-arabi16/SendStack/blob/main/chrome-extension/store/privacy-policy.md

---

## Store Metadata

| Field | Value |
|---|---|
| **Category** | Productivity |
| **Language** | English |
| **Version** | 1.0.0 |
| **Manifest** | V3 |
| **Size** | < 1 MB (zipped) |

---

## Required Assets Checklist

| Asset | Size | Status |
|---|---|---|
| Store icon | 128 × 128 PNG | `public/icons/icon128.png` |
| Screenshot 1 — Email panel | 1280 × 800 PNG | `store/screenshots/01-gmail-panel.png` |
| Screenshot 2 — WhatsApp panel | 1280 × 800 PNG | `store/screenshots/02-whatsapp-panel.png` |
| Screenshot 3 — Options page | 1280 × 800 PNG | `store/screenshots/03-options-page.png` |
| Screenshot 4 — Popup | 1280 × 800 PNG | `store/screenshots/04-popup.png` |

> **Note:** Run `npm run build` in `chrome-extension/` to produce the `dist/` folder.  
> Zip the `dist/` folder (`zip -r bulk-sender-extension.zip dist/`) to produce the upload artifact.  
> Current zipped size is well under the 10 MB Chrome Web Store limit.
