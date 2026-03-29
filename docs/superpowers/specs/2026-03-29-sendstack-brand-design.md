# SendStack — Brand Identity Spec

## Overview

Rebrand the "Bulk Email Sender" project to **SendStack** — a modern, developer-oriented bulk messaging platform. The brand conveys technical credibility, clean infrastructure, and reliability.

## Name

- **Brand name:** SendStack
- **Tagline:** Bulk Messaging Platform
- **Display tagline:** "Bulk messaging, simplified."
- **Wordmark treatment:** "Send" in white/black + "Stack" in accent green (#34d399 dark mode, #059669 light mode)

## Logo Mark

Stacked diamond/chevron layers representing queued messages in a send pipeline.

### SVG Structure (72x72 viewBox)
- **Top layer (filled):** Diamond shape `M36 12L60 24L36 36L12 24Z` — fill `#10b981` (dark) / `#059669` (light)
- **Middle layer (stroke):** `M60 32L36 44L12 32` — stroke `#34d399` (dark) / `#10b981` (light), width 3
- **Bottom layer (stroke):** `M60 42L36 54L12 42` — stroke `#6ee7b7` (dark) / `#34d399` (light), width 3
- All strokes: `stroke-linecap="round"` `stroke-linejoin="round"`

### Favicon / App Icon
- Dark background `#0a0a0a` with rounded corners
- Same stacked diamond mark, stroke widths increase at smaller sizes for legibility
- Sizes needed: 16x16, 32x32, 48x48, 64x64, 128x128, 192x192, 512x512

## Color System

### Primary Palette (Emerald)
| Token         | Hex       | Usage                              |
|---------------|-----------|-------------------------------------|
| primary       | `#059669` | Primary actions, links (light mode) |
| accent        | `#10b981` | Primary actions (dark mode), fills  |
| light         | `#34d399` | Wordmark accent, highlights         |
| muted         | `#6ee7b7` | Subtle accents, tertiary elements   |

### Surfaces
| Token         | Hex       | Usage                              |
|---------------|-----------|-------------------------------------|
| surface-dark  | `#0a0a0a` | Page background (dark mode)         |
| surface       | `#171717` | Card/input background (dark mode)   |
| border        | `#262626` | Borders, dividers (dark mode)       |
| surface-light | `#fafafa` | Page background (light mode)        |
| border-light  | `#e5e5e5` | Borders, dividers (light mode)      |

### Text
| Token         | Hex       | Usage                              |
|---------------|-----------|-------------------------------------|
| text-primary  | `#ffffff` | Headings, primary text (dark)       |
| text-secondary| `#a1a1aa` | Body text, descriptions (dark)      |
| text-muted    | `#71717a` | Labels, captions (dark)             |
| text-primary-light | `#0a0a0a` | Headings (light mode)          |

### Semantic Colors (keep existing)
| Token   | Hex       | Usage        |
|---------|-----------|--------------|
| success | `#34c759` | Send success |
| error   | `#ff3b30` | Send failure |
| warning | `#ff9f0a` | Rate limits  |

## Typography

- **Font stack:** `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif`
- **Mono stack:** `'SF Mono', 'Fira Code', 'Cascadia Code', monospace`
- **Display:** 40px, weight 800, letter-spacing -1.5px
- **Heading:** 24px, weight 600, letter-spacing -0.5px
- **Body:** 15px, weight 400, line-height 1.6
- **Caption/label:** 11-13px, weight 400-500, letter-spacing 1-2px uppercase
- **Template variables** in compose view: accent green with 10% green background, rounded pill

## Implementation Scope

### Files to Create
- `/public/logo.svg` — full logo mark SVG
- `/public/logo-with-text.svg` — logo + wordmark
- `/public/favicon.svg` — favicon as SVG
- `/public/favicon.ico` — generated from SVG (replace existing)
- `/public/icons/icon-192.png` — PWA icon
- `/public/icons/icon-512.png` — PWA icon
- `/chrome-extension/public/icons/` — regenerate 16, 48, 128 PNGs from new mark

### Files to Modify
- `/src/app/globals.css` — update CSS custom properties with new color tokens
- `/src/app/layout.tsx` — update metadata title/description to "SendStack"
- `/src/app/page.tsx` — update any references to old name
- `/src/components/EmailDashboard.tsx` — add logo to header, update title text
- `/chrome-extension/manifest.json` — update name to "SendStack"
- `/chrome-extension/src/App.tsx` — update branding
- `/package.json` — update name field
- `/README.md` — update project name and description

### Design Tokens to Add (globals.css)
```css
:root {
  --brand-primary: #059669;
  --brand-accent: #10b981;
  --brand-light: #34d399;
  --brand-muted: #6ee7b7;
  --surface-dark: #0a0a0a;
  --surface: #171717;
  --surface-border: #262626;
  --surface-light: #fafafa;
  --surface-border-light: #e5e5e5;
}
```

## Out of Scope
- Marketing site / landing page
- Brand guidelines PDF
- Social media assets
- Email templates redesign
