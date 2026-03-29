# Technology Stack

**Analysis Date:** 2026-03-29

## Languages

**Primary:**
- **TypeScript** 5.x - All source code and configuration
- **TSX (TypeScript + React)** - React UI components and entry points
- **JavaScript** - Build output and generated code

**Secondary:**
- HTML - Panel and options pages (`public/*.html`)
- CSS - Inline styles via React/JSX (no separate stylesheet files)

## Runtime

**Environment:**
- **Chrome Runtime** - Chrome extension API, service workers, content scripts
- **Browser APIs** - DOM, fetch, localStorage, IndexedDB via chrome.storage

**Package Manager:**
- **npm** [Version specified in package.json]
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- **React** 19.1.0 - UI rendering for popup, panel, options pages
- **React DOM** 19.1.0 - DOM mounting and rendering

**Build/Dev:**
- **Vite** 6.3.1 - Module bundler and dev server
  - Config: `vite.config.ts`
  - Plugin: `@vitejs/plugin-react` 4.4.1 for JSX transformation
  - Custom plugin for manifest and asset copying

**Testing:**
- **Playwright** 1.58.2 - E2E testing framework
  - Config: `playwright.config.ts`
  - Headless: false (requires headful Chrome for extension testing)
  - Test directory: `tests/e2e/`

**Type Checking:**
- **TypeScript Compiler** 5.x - `tsc --noEmit` with separate test config

## Key Dependencies

**Critical:**
- **DOMPurify** 3.2.5 - HTML sanitization for template preview rendering
  - Used in: `src/panel/App.tsx` for safe preview display
- **PapaParse** 5.5.3 - CSV parsing library
  - Used in: `src/lib/csv-parser.ts` for contact CSV parsing

**Infrastructure:**
- **@types/chrome** 0.0.324 - Chrome API TypeScript definitions
- **@types/dompurify** 3.0.5 - DOMPurify type definitions
- **@types/papaparse** 5.3.15 - PapaParse type definitions
- **@types/react** 19.x - React type definitions
- **@types/react-dom** 19.x - React DOM type definitions

## Configuration

**Environment:**
- No `.env` file in use (extension uses chrome.storage instead)
- chrome.storage.sync for settings persistence (cross-device)
- chrome.storage.local for runtime state (contacts, daily count)

**Build:**
- `vite.config.ts` - Vite bundling configuration with custom manifest copying
- `tsconfig.json` - TypeScript compiler options (ES2020 target, strict mode)
- `tsconfig.tests.json` - Separate TypeScript config for test files

**TypeScript Settings:**
- Target: ES2020
- Module: ESNext
- Module Resolution: bundler
- JSX: react-jsx
- Strict: true
- No emit (type checking only)

## Platform Requirements

**Development:**
- Node.js with npm
- Chrome browser (for extension runtime)
- macOS/Linux/Windows with `path` module support

**Production:**
- Chrome 90+ (Manifest V3 support)
- No backend or server requirements
- Runs entirely in-browser via chrome.storage

**Build Output:**
- `/dist/` directory contains:
  - `background.js` - Service worker
  - `content-gmail.js` - Gmail content script
  - `content-whatsapp.js` - WhatsApp Web content script
  - `popup.js` - Extension icon popup UI
  - `panel.js` - Side panel UI
  - `options.js` - Extension options page UI
  - `manifest.json` - Extension metadata
  - `/icons/` - Icon assets
  - `/*.html` - HTML entry points

## Script Commands

```bash
npm run build          # Production build to dist/
npm run dev            # Vite watch mode (rebuild on file change)
npm run typecheck      # Type checking (src + tests)
npm run test:e2e       # Playwright E2E tests
```

---

*Stack analysis: 2026-03-29*
