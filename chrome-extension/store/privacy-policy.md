# Privacy Policy — SendStack — Bulk Messaging

*Last updated: 2026-03-29*

---

## Overview

SendStack — Bulk Messaging ("the Extension") is a browser extension for Google Chrome that helps you send personalised bulk emails and WhatsApp messages directly from Gmail and WhatsApp Web.

We are committed to protecting your privacy.  This policy explains exactly what data the Extension collects, how it is stored, and what it is never used for.

---

## Data We Collect

The Extension stores the following data **locally in your browser** using `chrome.storage.local` and `chrome.storage.sync`:

| Data | Where stored | Purpose |
|---|---|---|
| Uploaded CSV rows (contacts) | `chrome.storage.local` | Populate the send queue; cleared when you upload a new CSV or remove the extension |
| User settings (delay, limits) | `chrome.storage.sync` | Restore your preferences across sessions and Chrome profiles |
| Daily send counter | `chrome.storage.local` | Enforce the daily sending limit you configure |

---

## Data We Do Not Collect

- **No email content is read.** The Extension only opens the Gmail compose window and fills in the `To`, `Subject`, and `Body` fields you provide via your template.  It does not read, scan, or transmit any existing emails.
- **No message history is read.** The Extension does not access your WhatsApp message history or contact list.
- **No data is transmitted to external servers.** All CSV data and settings remain on your device.  The Extension makes no outbound network requests of its own.
- **No analytics or telemetry.** The Extension does not include any analytics SDK, tracking pixel, or crash-reporting service.
- **No user accounts.** The Extension does not require you to create an account or log in.

---

## Third-Party Services

The Extension does not integrate with any third-party services.  It interacts only with:

- **Gmail** (`mail.google.com`) — by injecting a sidebar panel and automating the native compose window.
- **WhatsApp Web** (`web.whatsapp.com`) — by injecting a sidebar panel and navigating to `web.whatsapp.com/send?phone=…` URLs.

These services have their own privacy policies:
- [Google Privacy Policy](https://policies.google.com/privacy)
- [Meta Privacy Policy](https://www.whatsapp.com/legal/privacy-policy)

---

## Data Retention

- CSV contact data is retained in `chrome.storage.local` until you upload a new file or uninstall the Extension.
- Settings are retained in `chrome.storage.sync` until you uninstall the Extension or clear Chrome sync data.
- The daily send counter is reset automatically at midnight each day.

---

## Children's Privacy

The Extension is not directed at children under the age of 13.  We do not knowingly collect personal information from children.

---

## Changes to This Policy

We may update this Privacy Policy from time to time.  Any changes will be reflected in the "Last updated" date at the top of this document and will be committed to the public repository at:

> https://github.com/mohamed-arabi16/Bulk-Email-sender/blob/main/chrome-extension/store/privacy-policy.md

---

## Contact

If you have questions about this Privacy Policy or the Extension's data practices, please open an issue at:

> https://github.com/mohamed-arabi16/Bulk-Email-sender/issues
