export class SelectorError extends Error {
  selectorName: string;
  constructor(selectorName: string) {
    super(`${selectorName} not found`);
    this.name = 'SelectorError';
    this.selectorName = selectorName;
  }
}

export interface SelectorDef {
  name: string;
  selectors: string[];
  critical: boolean;
}

export const WHATSAPP_SELECTORS: SelectorDef[] = [
  { name: 'CHAT_LIST', selectors: ['#pane-side', '[data-testid="chat-list"]'], critical: true },
  { name: 'MSG_INPUT', selectors: ['footer [contenteditable="true"]', '[data-testid="conversation-compose-box-input"]'], critical: true },
  { name: 'SEND_BUTTON', selectors: ['[data-testid="send"]', '[aria-label="Send"]', 'footer button[aria-label]'], critical: false },
  { name: 'INVALID_PHONE', selectors: ['[data-testid="intro-text"]'], critical: false },
];

export const GMAIL_SELECTORS: SelectorDef[] = [
  { name: 'NAV', selectors: ['[role="navigation"]'], critical: true },
  { name: 'COMPOSE_BTN', selectors: ['[gh="cm"]'], critical: true },
  { name: 'TO_FIELD', selectors: ['[role="dialog"] [name="to"]'], critical: false },
  { name: 'SUBJECT', selectors: ['[name="subjectbox"]'], critical: false },
  { name: 'BODY', selectors: ['[role="textbox"][aria-label]'], critical: false },
  { name: 'SEND_BTN', selectors: ['[data-tooltip*="Send"]', '[aria-label*="Send"]'], critical: false },
];

export function findElement(def: SelectorDef, timeout = 15000): Promise<Element> {
  return new Promise((resolve, reject) => {
    for (const sel of def.selectors) {
      const el = document.querySelector(sel);
      if (el) { resolve(el); return; }
    }
    const observer = new MutationObserver(() => {
      for (const sel of def.selectors) {
        const el = document.querySelector(sel);
        if (el) { observer.disconnect(); resolve(el); return; }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new SelectorError(def.name)); }, timeout);
  });
}

export function findSelector(name: string, registry: SelectorDef[]): SelectorDef {
  const def = registry.find(d => d.name === name);
  if (!def) throw new Error(`Unknown selector: ${name}`);
  return def;
}

export async function runPreflight(registry: SelectorDef[]): Promise<{ ready: boolean; failures: string[] }> {
  const critical = registry.filter(d => d.critical);
  const failures: string[] = [];
  for (const def of critical) {
    try {
      await findElement(def, 3000);
    } catch {
      failures.push(def.name);
    }
  }
  return { ready: failures.length === 0, failures };
}
