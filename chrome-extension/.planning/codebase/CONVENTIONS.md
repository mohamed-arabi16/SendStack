# Coding Conventions

**Analysis Date:** 2026-03-29

## Naming Patterns

**Files:**
- React components: PascalCase for main component file (e.g., `App.tsx`, `Popup.tsx`)
- Index files: `index.tsx` for entry points that mount React apps
- Utility modules: camelCase with `.ts` extension (e.g., `csv-parser.ts`, `messaging.ts`)
- Content scripts: kebab-case with semantic naming (e.g., `content-gmail.ts`, `content-whatsapp.ts`)
- Service worker: `background.ts`

**Functions:**
- camelCase for all functions (async and sync)
- Private/internal functions: prefixed with `_` when needed for scope clarity (e.g., `_activeWaJob`, `_sender`)
- Handler functions: prefixed with `handle` or `on` for event listeners (e.g., `handleMessage`, `handleFileUpload`, `handleDrop`)
- Utility functions: descriptive verb-noun pattern (e.g., `sendToBackground`, `parseCSV`, `resolveTemplate`)

**Variables:**
- camelCase for all variables and constants
- Constants defined at module level with `const` (no `UPPER_SNAKE_CASE` convention observed)
- State variables in React: descriptive nouns (e.g., `contacts`, `template`, `status`, `progress`)
- Ref variables: suffix `Ref` (e.g., `fileInputRef`, `cooldownRef`)

**Types:**
- PascalCase for all interface and type names (e.g., `ExtensionSettings`, `Contact`, `LogEntry`)
- Type suffix convention: none enforced, types represent domain concepts
- Branded types: use `type` keyword for union types and type aliases

**Example from codebase:**
```typescript
// From src/lib/storage.ts
export interface ExtensionSettings {
  defaultMode: 'email' | 'whatsapp';
  delayPreset: 'fast' | 'normal' | 'safe' | 'custom';
  customDelaySeconds: number;
  jitterEnabled: boolean;
  batchSize: number;
  cooldownSeconds: number;
  dailyLimit: number;
  spinSyntaxEnabled: boolean;
  sidebarPosition: 'left' | 'right';
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultMode: 'email',
  delayPreset: 'normal',
  customDelaySeconds: 10,
  // ...
};
```

## Code Style

**Formatting:**
- No explicit formatter detected (no `.prettierrc` or similar config)
- Consistent 2-space indentation observed throughout codebase
- Line length: approximately 100 characters (some lines exceed this)
- Semicolons: required (TypeScript strict mode)

**Linting:**
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.json`
- Target: ES2020
- JSX mode: react-jsx (React 17+ automatic runtime)
- ESLint not explicitly configured, but TypeScript compiler serves as primary type checker

**Spacing conventions:**
- Single space after control flow keywords (if, for, while, etc.)
- No spaces inside object/array literals
- Single blank line between logical sections in files
- Double blank line rarely used

**Example from codebase:**
```typescript
// From src/panel/App.tsx
const handleFileUpload = useCallback(async (file: File) => {
  try {
    const { headers: h, contacts: c } = await parseCSV(file);
    setHeaders(h);
    setContacts(c);
    setCsvWarning(c.length > 5000 ? `⚠️ ${c.length} contacts — approaching storage limit. Consider splitting the CSV.` : '');
    await saveContactsToStorage(c);
  } catch (err) {
    setErrorBanner('Failed to parse CSV: ' + String(err));
  }
}, []);
```

## Import Organization

**Order:**
1. External packages (`react`, `@playwright/test`, `papaparse`, `dompurify`)
2. Local types (using `import type { ... }` syntax)
3. Local utility/library imports
4. Local component imports

**Path Aliases:**
- Relative paths only (no @ aliases or path mapping observed)
- Prefer `../lib/` for shared utilities
- Prefer `../` for cross-component imports

**Example from codebase:**
```typescript
// From src/panel/App.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { parseCSV, loadContactsFromStorage, saveContactsToStorage, resolveTemplate, resolveSpin } from '../lib/csv-parser';
import { sendToBackground } from '../lib/messaging';
import type { ExtensionSettings } from '../lib/storage';
import type { Contact } from '../lib/csv-parser';
import DOMPurify from 'dompurify';
```

**Type imports:**
- Use `import type { ... }` syntax consistently to indicate type-only imports (enables tree-shaking)

## Error Handling

**Patterns:**
- Promise-based async/await with try/catch blocks
- Error messages prefixed with context (e.g., `'Failed to parse CSV: ' + String(err)`)
- Chrome API callbacks wrapped in Promise constructors for consistency
- No explicit error typing (all errors cast as `Error` or generic `unknown`)
- Graceful degradation: catches without re-throw for non-critical failures

**Example from codebase:**
```typescript
// From src/lib/messaging.ts
export function sendToBackground<T = unknown>(
  action: MessageAction,
  payload?: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, payload }, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
```

**Logging:**
- `console.warn()` for non-critical warnings (e.g., CSV size warnings)
- `console.error()` passed to `.catch()` for unhandled promise rejections
- Prefixed log messages: `[BulkSender]` for identifying extension logs
- No dedicated logging framework

**Example:**
```typescript
console.warn(`[BulkSender] CSV has ${contacts.length} contacts — approaching chrome.storage.local 10 MB limit.`);
```

## Comments

**When to Comment:**
- Inline comments explain non-obvious logic (e.g., phone normalization, jitter calculation)
- JSDoc-style comments for exported functions and public APIs
- Block comments (`// ----`) separate logical sections within files

**JSDoc/TSDoc:**
- Minimal JSDoc adoption; used for utility functions with behavioral complexity
- Function-level comments preferred over parameter descriptions
- No `@param`, `@returns` tags observed

**Example from codebase:**
```typescript
/**
 * Resolve {{Variable}} placeholders using contact data.
 * Sanitizes by stripping HTML tags for safety.
 */
export function resolveTemplate(template: string, contact: Contact): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = contact[key] ?? contact[key.toLowerCase()] ?? '';
    // Strip any potential HTML tags for safety
    return String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
}
```

**Section markers:**
```typescript
// ---- Panel injection ----
// ---- Gmail Compose automation ----
// ---- WhatsApp bulk-job state (survives page navigations) ----
```

## Function Design

**Size:**
- Typically 10–50 lines for utility functions
- Content script handlers range 100–150 lines (complex DOM interactions)
- React components: App.tsx spans 320 lines (main panel component, acceptable due to state complexity)
- No strict line-count limit enforced

**Parameters:**
- Prefer single object parameter for multiple related arguments
- Generic type parameters used for async functions (e.g., `sendToBackground<T>`)
- Destructuring used in function bodies for clarity

**Example:**
```typescript
// From src/background.ts
async function advanceWaJob(
  updates: { sent: number; failed: number }
): Promise<{ nextIndex: number; status: WaJobState['status'] }> {
  const job = await getActiveWaJob();
  if (!job) return { nextIndex: -1, status: 'completed' };
  // ...
}
```

**Return Values:**
- Explicit `Promise<T>` return types for async functions
- Early returns to reduce nesting (guard clauses)
- Consistent return type signatures in message handlers

## Module Design

**Exports:**
- Explicit named exports for utilities (no default exports in `.ts` utility files)
- Default exports for React components (each gets own file)
- Mix of type and value exports in modules like `storage.ts`

**Barrel Files:**
- Entry point files (`popup/index.tsx`, `panel/index.tsx`) mount React apps
- No centralized barrel re-exports; each module exports directly

**Example structure:**
```typescript
// popup/index.tsx — entry point, mounts component
import React from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './Popup';

createRoot(document.getElementById('root')!).render(<Popup />);

// Popup.tsx — actual component, default export
export default function Popup() { ... }
```

## Chrome API Usage

**Pattern:**
- Wrap callback-based Chrome APIs in Promise constructors for async/await compatibility
- Type responses with generics (e.g., `sendToBackground<ExtensionSettings>`)
- Handle `chrome.runtime.lastError` explicitly for error detection

**Example:**
```typescript
export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(SETTINGS_KEY, (result) => {
      resolve((result[SETTINGS_KEY] as ExtensionSettings) ?? DEFAULT_SETTINGS);
    });
  });
}
```

## Type Safety

**Patterns:**
- Non-null assertions (`!`) used sparingly, only where types cannot be narrowed
- Optional chaining (`?.`) used consistently for safe property access
- Nullish coalescing (`??`) preferred over logical OR for default values
- Type casts with `as` used only when type cannot be inferred (Chrome API responses)

---

*Convention analysis: 2026-03-29*
