import { resolveTemplate, resolveSpin, applyJitter, sleep } from './lib/csv-parser';
import type { Contact } from './lib/csv-parser';
import { sendToBackground } from './lib/messaging';
import type { ExtensionSettings } from './lib/storage';

// ---- Panel injection ----
let panelVisible = false;
let shadowHost: HTMLDivElement | null = null;
let cancelRequested = false;

function waitForElement(selector: string, timeout = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) { resolve(el); return; }
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { observer.disconnect(); resolve(found); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout waiting for ${selector}`)); }, timeout);
  });
}

async function injectPanel() {
  // Wait for Gmail to load
  try {
    await waitForElement('[role="navigation"]', 15000);
  } catch {
    console.warn('[BulkSender] Gmail nav not found, injecting anyway');
  }

  // Create floating toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'bulk-sender-toggle';
  toggleBtn.textContent = 'SendStack';
  toggleBtn.style.cssText = [
    'position:fixed', 'right:0', 'top:50%', 'transform:translateY(-50%)',
    'z-index:99999', 'background:#10b981', 'color:#fff', 'border:none',
    'border-radius:8px 0 0 8px', 'padding:12px 10px', 'cursor:pointer',
    'font-size:13px', 'font-family:-apple-system,BlinkMacSystemFont,sans-serif', 'writing-mode:vertical-rl',
    'text-orientation:mixed', 'box-shadow:-2px 0 8px rgba(0,0,0,0.2)',
  ].join(';');

  toggleBtn.addEventListener('click', togglePanel);
  document.body.appendChild(toggleBtn);

  // Create shadow DOM container
  shadowHost = document.createElement('div');
  shadowHost.id = 'bulk-sender-panel-host';
  shadowHost.style.cssText = [
    'position:fixed', 'right:0', 'top:0', 'height:100vh', 'width:420px',
    'z-index:99998', 'display:none', 'box-shadow:-4px 0 20px rgba(0,0,0,0.15)',
  ].join(';');
  document.body.appendChild(shadowHost);

  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

  // Inject panel content via iframe pointing to panel.html
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('panel.html') + '?mode=email';
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  shadowRoot.appendChild(iframe);

  // Listen for messages from the panel iframe
  window.addEventListener('message', handlePanelMessage);

  // Forward progress messages to the panel iframe
  window.addEventListener('message', (event) => {
    const data = event.data as { type?: string };
    if (!data?.type) return;
    if (data.type === 'BULK_SENDER_PROGRESS' || data.type === 'BULK_SENDER_COOLDOWN' || data.type === 'BULK_SENDER_COMPLETE') {
      const panelIframe = shadowRoot.querySelector('iframe');
      panelIframe?.contentWindow?.postMessage(event.data, '*');
    }
  });
}

function togglePanel() {
  panelVisible = !panelVisible;
  if (shadowHost) {
    shadowHost.style.display = panelVisible ? 'block' : 'none';
  }
}

// ---- Gmail Compose automation ----

async function sendViaGmailCompose(to: string, subject: string, body: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await doSend(to, subject, body);
      return;
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(2000);
    }
  }
}

async function doSend(to: string, subject: string, body: string): Promise<void> {
  // Click Compose button or press 'c'
  const composeBtn = document.querySelector('[gh="cm"]') as HTMLElement | null;
  if (composeBtn) {
    composeBtn.click();
  } else {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
  }

  // Wait for compose window
  const composeWindow = await waitForElement('[role="dialog"] [name="to"]', 5000) as HTMLInputElement;

  // Fill To
  composeWindow.focus();
  setNativeValue(composeWindow, to);
  composeWindow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

  await sleep(300);

  // Fill Subject
  const subjectField = document.querySelector('[name="subjectbox"]') as HTMLInputElement | null;
  if (subjectField) {
    subjectField.focus();
    setNativeValue(subjectField, subject);
  }

  await sleep(300);

  // Fill Body
  const bodyField = document.querySelector('[role="textbox"][aria-label]') as HTMLElement | null;
  if (bodyField) {
    bodyField.focus();
    // Use execCommand to insert text into Gmail's contenteditable
    document.execCommand('selectAll');
    document.execCommand('insertText', false, body);
  }

  await sleep(500);

  // Click Send
  const sendBtn = document.querySelector(
    '[data-tooltip="Send ‪(Ctrl-Enter)‬"], [data-tooltip="Send "], [aria-label*="Send"]'
  ) as HTMLElement | null;
  if (sendBtn) {
    sendBtn.click();
  } else {
    // Fallback: Ctrl+Enter
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  }

  // Wait for compose to close
  await waitForElementGone('[role="dialog"] [name="to"]', 5000);
}

function waitForElementGone(selector: string, timeout = 5000): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (!document.querySelector(selector)) { resolve(); return; }
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(); }, timeout);
  });
}

function setNativeValue(element: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ---- Bulk Email Job ----

async function runEmailJob(contacts: Contact[], template: string, subject: string, settings: ExtensionSettings) {
  cancelRequested = false;
  const total = contacts.length;
  let sent = 0, failed = 0;

  const delayMap: Record<string, number> = { fast: 5000, normal: 10000, safe: 15000 };
  const baseDelay = settings.delayPreset === 'custom'
    ? settings.customDelaySeconds * 1000
    : (delayMap[settings.delayPreset] ?? 10000);

  for (let i = 0; i < contacts.length; i++) {
    if (cancelRequested) break;

    const contact = contacts[i];
    const to = contact.email ?? '';

    // Enforce daily limit before each send
    const { sent: dailySent, limit: dailyLimit } = await sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT');
    if (dailySent >= dailyLimit) {
      failed++;
      postProgress(i + 1, total, sent, failed, 'skipped', to, 'Daily limit reached');
      break;
    }

    if (!to) {
      failed++;
      postProgress(i + 1, total, sent, failed, 'skipped', to, 'No email address');
      continue;
    }

    let resolvedBody = resolveTemplate(template, contact);
    if (settings.spinSyntaxEnabled) resolvedBody = resolveSpin(resolvedBody);
    const resolvedSubject = resolveTemplate(subject, contact);

    try {
      await sendViaGmailCompose(to, resolvedSubject, resolvedBody);
      sent++;
      await sendToBackground('INCREMENT_COUNT', { n: 1 });
      postProgress(i + 1, total, sent, failed, 'success', to);
    } catch (err) {
      failed++;
      postProgress(i + 1, total, sent, failed, 'error', to, String(err));
    }

    // Batch cool-down
    if ((i + 1) % settings.batchSize === 0 && i + 1 < contacts.length) {
      postCooldown(settings.cooldownSeconds);
      await sleep(settings.cooldownSeconds * 1000);
    } else {
      const delay = settings.jitterEnabled ? applyJitter(baseDelay) : baseDelay;
      await sleep(delay);
    }
  }

  postJobComplete(sent, failed, total - sent - failed);
}

function postProgress(current: number, total: number, sent: number, failed: number, status: string, recipient: string, error?: string) {
  window.postMessage({ type: 'BULK_SENDER_PROGRESS', current, total, sent, failed, status, recipient, error }, '*');
}

function postCooldown(seconds: number) {
  window.postMessage({ type: 'BULK_SENDER_COOLDOWN', seconds }, '*');
}

function postJobComplete(sent: number, failed: number, skipped: number) {
  window.postMessage({ type: 'BULK_SENDER_COMPLETE', sent, failed, skipped }, '*');
}

// ---- Message handler from panel iframe ----

function handlePanelMessage(event: MessageEvent) {
  const data = event.data as { type: string; [key: string]: unknown };
  if (!data || !data.type) return;

  if (data.type === 'START_EMAIL_JOB') {
    const { contacts, template, subject, settings } = data as unknown as {
      contacts: Contact[]; template: string; subject: string; settings: ExtensionSettings;
    };
    runEmailJob(contacts, template, subject, settings).catch(console.error);
  } else if (data.type === 'CANCEL_JOB') {
    cancelRequested = true;
  }
}

// ---- Init ----
injectPanel().catch(console.error);
