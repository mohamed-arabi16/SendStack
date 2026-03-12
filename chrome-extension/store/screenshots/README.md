# Store Screenshots — Visual Guide

All screenshots must be exactly **1280 × 800 pixels PNG** for the Chrome Web Store.

---

## Screenshot 1 — Gmail Panel (`01-gmail-panel.png`)

**What to capture:**
1. Open Gmail in Chrome with the extension loaded.
2. Click the **"✉️ Bulk Sender"** toggle tab on the right edge.
3. In the panel, upload `tests/fixtures/contacts-3-email.csv`.
4. Set the template body to `Hello {{Name}}, this is a personalised message for you!`.
5. Take a 1280 × 800 screenshot showing:
   - The full Gmail inbox on the left.
   - The slide-in Bulk Sender panel on the right with contacts loaded and a progress bar visible.

**Caption for the store:** "Send personalised emails to hundreds of contacts directly from Gmail — no API keys required."

---

## Screenshot 2 — WhatsApp Panel (`02-whatsapp-panel.png`)

**What to capture:**
1. Open WhatsApp Web in Chrome with the extension loaded.
2. Click the **"💬 Bulk Sender"** toggle tab on the right edge.
3. In the panel, upload `tests/fixtures/contacts-3-wa.csv`.
4. Set the template to `Hi {{Name}}! Just wanted to reach out.`.
5. Take a 1280 × 800 screenshot showing:
   - The WhatsApp Web chat list on the left.
   - The Bulk Sender panel on the right with contacts loaded.

**Caption for the store:** "Automate WhatsApp bulk messaging from WhatsApp Web — with built-in anti-ban delays and daily limits."

---

## Screenshot 3 — Options Page (`03-options-page.png`)

**What to capture:**
1. Open the extension's options page (`chrome-extension://<id>/options.html`).
2. Ensure all settings sections are visible:
   - Delay preset selector
   - Custom delay / jitter toggle
   - Daily sending limit
   - Batch size and cool-down
   - Spin syntax toggle
3. Take a 1280 × 800 screenshot of the full options page.

**Caption for the store:** "Full control over send delays, daily limits, and anti-ban settings — all stored locally in your browser."

---

## Promotional Tile (`promo-tile-440x280.png`)

**Size:** 440 × 280 pixels PNG.

**Design guidelines:**
- Dark background (`#1a1a2e` or similar).
- Extension name in large bold white text: "Bulk Email & WhatsApp Sender".
- Tagline in smaller text: "Personalised bulk messaging from Gmail & WhatsApp Web".
- Two icons: ✉️ (Gmail) and 💬 (WhatsApp) side by side.
- No screenshots — promotional tiles must be graphical only.

---

## Store Icon (`icon-128.png`)

The extension icon at 128 × 128 pixels is generated automatically by the build from `src/assets/icon.svg`.  A copy is placed in `dist/icon-128.png` after `npm run build`.

If you need to generate it manually:

```bash
cd chrome-extension
# Using ImageMagick
convert -background none src/assets/icon.svg -resize 128x128 store/icon-128.png
# Or using Inkscape
inkscape --export-type=png --export-width=128 --export-height=128 \
         --export-filename=store/icon-128.png src/assets/icon.svg
```
