# SendStack Brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand "Bulk Email Sender" to "SendStack" — new logo SVGs, favicon, updated color tokens, and name changes across the web app and Chrome extension.

**Architecture:** Create SVG logo assets in `/public/`, update CSS design tokens in `globals.css` to the new emerald palette, update all title/name references in layout metadata, dashboard header, Chrome extension manifest, popup, and package.json.

**Tech Stack:** SVG, CSS custom properties, Next.js metadata, Chrome extension manifest v3

---

## File Map

### Files to Create
| File | Responsibility |
|------|---------------|
| `/public/logo.svg` | Logo mark only (stacked diamond layers) |
| `/public/logo-with-text.svg` | Logo mark + "SendStack" wordmark |
| `/public/favicon.svg` | Favicon-optimized logo on dark background |

### Files to Modify
| File | Change |
|------|--------|
| `/src/app/globals.css` | Replace color tokens with SendStack emerald palette |
| `/src/app/layout.tsx` | Update metadata title, description, favicon reference, theme colors |
| `/src/components/EmailDashboard.tsx:676-683` | Replace header icon + title with SendStack logo and name |
| `/chrome-extension/manifest.json` | Update `name` and `description` |
| `/chrome-extension/src/popup/Popup.tsx:27` | Update title from "Bulk Sender" to "SendStack" |
| `/package.json` | Update `name` field |

---

### Task 1: Create Logo SVG Assets

**Files:**
- Create: `/public/logo.svg`
- Create: `/public/logo-with-text.svg`
- Create: `/public/favicon.svg`

- [ ] **Step 1: Create the logo mark SVG**

Write `/public/logo.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72" fill="none">
  <path d="M36 12L60 24L36 36L12 24L36 12Z" fill="#10b981" opacity="0.9"/>
  <path d="M60 32L36 44L12 32" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M60 42L36 54L12 42" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 2: Create the logo with wordmark SVG**

Write `/public/logo-with-text.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="48" viewBox="0 0 220 48" fill="none">
  <!-- Icon -->
  <path d="M24 4L44 14L24 24L4 14L24 4Z" fill="#10b981" opacity="0.9"/>
  <path d="M44 20L24 30L4 20" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M44 28L24 38L4 28" stroke="#6ee7b7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Text -->
  <text x="54" y="30" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif" font-size="24" font-weight="700" letter-spacing="-0.5">
    <tspan fill="#ffffff">Send</tspan><tspan fill="#34d399">Stack</tspan>
  </text>
</svg>
```

- [ ] **Step 3: Create the favicon SVG**

Write `/public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="6" fill="#0a0a0a"/>
  <path d="M16 5L28 11L16 17L4 11L16 5Z" fill="#10b981" opacity="0.9"/>
  <path d="M28 15L16 21L4 15" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M28 20L16 26L4 20" stroke="#6ee7b7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 4: Verify SVGs render correctly**

Open each SVG in the browser to verify:
```bash
open /Users/mohamedkhair/Coding/Bulk-Email-sender/public/logo.svg
open /Users/mohamedkhair/Coding/Bulk-Email-sender/public/logo-with-text.svg
open /Users/mohamedkhair/Coding/Bulk-Email-sender/public/favicon.svg
```

- [ ] **Step 5: Commit**

```bash
git add public/logo.svg public/logo-with-text.svg public/favicon.svg
git commit -m "feat: add SendStack logo SVG assets"
```

---

### Task 2: Update CSS Design Tokens

**Files:**
- Modify: `/src/app/globals.css:4-55` (design tokens block)

- [ ] **Step 1: Replace light mode tokens**

In `/src/app/globals.css`, replace the `:root` block (lines 4-32) with:

```css
:root {
    --bg-primary: #fafafa;
    --bg-card: rgba(255, 255, 255, 0.72);
    --bg-card-solid: #ffffff;
    --bg-hover: rgba(0, 0, 0, 0.03);
    --border-light: rgba(0, 0, 0, 0.08);
    --border-medium: rgba(0, 0, 0, 0.12);
    --text-primary: #0a0a0a;
    --text-secondary: #6e6e73;
    --text-tertiary: #86868b;
    --accent: #059669;
    --accent-hover: #047857;
    --accent-light: rgba(5, 150, 105, 0.08);
    --green: #34c759;
    --green-bg: rgba(52, 199, 89, 0.08);
    --red: #ff3b30;
    --red-bg: rgba(255, 59, 48, 0.08);
    --amber: #ff9f0a;
    --amber-bg: rgba(255, 159, 10, 0.08);
    --glass-blur: 20px;
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
    --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);
    --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.1);
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --transition: 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
```

- [ ] **Step 2: Replace dark mode tokens**

Replace the `@media (prefers-color-scheme: dark)` block (lines 34-55) with:

```css
@media (prefers-color-scheme: dark) {
    :root {
        --bg-primary: #0a0a0a;
        --bg-card: rgba(23, 23, 23, 0.72);
        --bg-card-solid: #171717;
        --bg-hover: rgba(255, 255, 255, 0.06);
        --border-light: rgba(255, 255, 255, 0.08);
        --border-medium: rgba(255, 255, 255, 0.12);
        --text-primary: #fafafa;
        --text-secondary: #a1a1aa;
        --text-tertiary: #71717a;
        --accent: #10b981;
        --accent-hover: #34d399;
        --accent-light: rgba(16, 185, 129, 0.12);
        --green-bg: rgba(52, 199, 89, 0.15);
        --red-bg: rgba(255, 59, 48, 0.15);
        --amber-bg: rgba(255, 159, 10, 0.15);
        --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.2);
        --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3);
        --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
}
```

- [ ] **Step 3: Update the header-icon gradient**

Replace the `.header-icon` background (line 128) from:
```css
background: linear-gradient(135deg, var(--accent), #5856d6);
```
to:
```css
background: linear-gradient(135deg, #10b981, #059669);
```

And update its box-shadow (line 134) from:
```css
box-shadow: 0 4px 12px rgba(0, 113, 227, 0.25);
```
to:
```css
box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
```

- [ ] **Step 4: Update the background blobs**

Replace the `.page-wrapper::before` radial gradient (line 86) from:
```css
background: radial-gradient(circle, rgba(0, 113, 227, 0.06) 0%, transparent 70%);
```
to:
```css
background: radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%);
```

The `.page-wrapper::after` blob already uses green — no change needed.

- [ ] **Step 5: Update accent-colored box-shadows**

Replace `.step-number.active` box-shadow (line 206) from:
```css
box-shadow: 0 2px 8px rgba(0, 113, 227, 0.3);
```
to:
```css
box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
```

Replace `.upload-zone.dragging` box-shadow (line 262) from:
```css
box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.1);
```
to:
```css
box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
```

Replace `.field-select:focus` / `.field-input:focus` / `.field-textarea:focus` box-shadow (line 423) from:
```css
box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.12);
```
to:
```css
box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
```

Replace `.btn-primary:hover` box-shadow (line 668) from:
```css
box-shadow: 0 4px 12px rgba(0, 113, 227, 0.25);
```
to:
```css
box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
```

- [ ] **Step 6: Verify the app renders with new colors**

```bash
cd /Users/mohamedkhair/Coding/Bulk-Email-sender && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update design tokens to SendStack emerald palette"
```

---

### Task 3: Update App Metadata and Favicon

**Files:**
- Modify: `/src/app/layout.tsx`

- [ ] **Step 1: Update layout.tsx metadata**

Replace the entire content of `/src/app/layout.tsx` with:

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "SendStack — Bulk Messaging Platform",
  description:
    "Upload a CSV, personalize with template variables, and send bulk emails and WhatsApp messages. Supports Arabic & English, iCloud+, Gmail, and custom domains.",
  keywords: ["sendstack", "bulk email", "whatsapp", "csv", "smtp", "messaging platform"],
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: update metadata to SendStack branding"
```

---

### Task 4: Update Dashboard Header with Logo

**Files:**
- Modify: `/src/components/EmailDashboard.tsx:676-683`

- [ ] **Step 1: Replace the header section**

In `/src/components/EmailDashboard.tsx`, find and replace the header block (lines 676-683):

Old:
```tsx
                <div className="header-icon">
                    {mode === 'email' ? <Mail className="w-8 h-8" /> : <MessageCircle className="w-8 h-8" />}
                </div>
                <div>
                    <h1 className="header-title">Bulk {mode === 'email' ? 'Email' : 'WhatsApp'} Sender</h1>
                    <p className="header-subtitle">Upload CSV · Personalize · Send</p>
                </div>
```

New:
```tsx
                <div className="header-icon">
                    <svg width="28" height="28" viewBox="0 0 72 72" fill="none">
                        <path d="M36 12L60 24L36 36L12 24L36 12Z" fill="#10b981" opacity="0.9"/>
                        <path d="M60 32L36 44L12 32" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M60 42L36 54L12 42" stroke="#6ee7b7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
                <div>
                    <h1 className="header-title">Send<span style={{ color: 'var(--accent)' }}>Stack</span></h1>
                    <p className="header-subtitle">Upload CSV · Personalize · Send</p>
                </div>
```

- [ ] **Step 2: Verify the header renders correctly**

```bash
cd /Users/mohamedkhair/Coding/Bulk-Email-sender && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/EmailDashboard.tsx
git commit -m "feat: update dashboard header with SendStack logo and name"
```

---

### Task 5: Update Chrome Extension Branding

**Files:**
- Modify: `/chrome-extension/manifest.json`
- Modify: `/chrome-extension/src/popup/Popup.tsx:27`

- [ ] **Step 1: Update manifest.json**

In `/chrome-extension/manifest.json`, change line 3:

Old:
```json
  "name": "Bulk Email & WhatsApp Sender",
```

New:
```json
  "name": "SendStack — Bulk Messaging",
```

And change line 5:

Old:
```json
  "description": "Send bulk emails and WhatsApp messages from Gmail and WhatsApp Web.",
```

New:
```json
  "description": "SendStack: Send bulk emails and WhatsApp messages from Gmail and WhatsApp Web.",
```

- [ ] **Step 2: Update Popup.tsx title**

In `/chrome-extension/src/popup/Popup.tsx`, change line 27:

Old:
```tsx
      <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px' }}>📨 Bulk Sender</div>
```

New:
```tsx
      <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px' }}>SendStack</div>
```

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/manifest.json chrome-extension/src/popup/Popup.tsx
git commit -m "feat: update Chrome extension branding to SendStack"
```

---

### Task 6: Update Package Name

**Files:**
- Modify: `/package.json`

- [ ] **Step 1: Update package.json name**

In `/package.json`, change line 2:

Old:
```json
  "name": "email-sender",
```

New:
```json
  "name": "sendstack",
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: rename package to sendstack"
```
