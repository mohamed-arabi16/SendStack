import { resolveTemplate, resolveSpin, applyJitter, sleep } from './lib/csv-parser';
import type { Contact } from './lib/csv-parser';
import { sendToBackground } from './lib/messaging';
import type { ExtensionSettings } from './lib/storage';
import { findElement, findSelector, runPreflight, GMAIL_SELECTORS } from './lib/selectors';
import { CIRCUIT_BREAKER_THRESHOLD, RETRY_ATTEMPTS, RETRY_BACKOFF_MS, isRetryableError } from './lib/circuit-breaker';

let panelVisible = false;
let shadowHost: HTMLDivElement | null = null;
let panelIframe: HTMLIFrameElement | null = null;
let cancelRequested = false;

function notifyError(message: string) {
  sendToBackground('FIRE_NOTIFICATION', { title: 'SendStack', message }).catch(() => {});
}

function postToPanel(data: Record<string, unknown>) {
  panelIframe?.contentWindow?.postMessage(data, '*');
}

async function injectPanel() {
  // Wait for Gmail to load (non-blocking)
  try {
    await findElement(findSelector('NAV', GMAIL_SELECTORS), 15000);
  } catch {
    // Will be caught by pre-flight check in panel
  }

  // Create floating toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'bulk-sender-toggle';
  toggleBtn.textContent = '\u2709 Bulk Sender';
  toggleBtn.style.cssText = [
    'position:fixed', 'right:0', 'top:50%', 'transform:translateY(-50%)',
    'z-index:99999', 'background:#1a73e8', 'color:#fff', 'border:none',
    'border-radius:8px 0 0 8px', 'padding:12px 10px', 'cursor:pointer',
    'font-size:13px', 'font-family:sans-serif', 'writing-mode:vertical-rl',
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
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('panel.html') + '?mode=email';
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.onerror = () => notifyError('Panel failed to load on Gmail');
  shadowRoot.appendChild(iframe);
  panelIframe = iframe;

  window.addEventListener('message', handlePanelMessage);

  // Forward progress messages to the panel iframe
  window.addEventListener('message', (event) => {
    const data = event.data as { type?: string };
    if (!data?.type) return;
    if (data.type === 'BULK_SENDER_PROGRESS' || data.type === 'BULK_SENDER_COOLDOWN' || data.type === 'BULK_SENDER_COMPLETE') {
      postToPanel(event.data as Record<string, unknown>);
    }
  });
}

function togglePanel() {
  panelVisible = !panelVisible;
  if (shadowHost) {
    shadowHost.style.display = panelVisible ? 'block' : 'none';
  }
}

// ---- Retry wrapper ----

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === RETRY_ATTEMPTS) throw err;
      await sleep(RETRY_BACKOFF_MS);
    }
  }
  throw lastError;
}

// ---- Gmail Compose automation ----

async function doSend(to: string, subject: string, body: string): Promise<void> {
  const composeBtnDef = findSelector('COMPOSE_BTN', GMAIL_SELECTORS);
  let composeBtn: Element | null = null;
  for (const sel of composeBtnDef.selectors) {
    composeBtn = document.querySelector(sel);
    if (composeBtn) break;
  }
  if (composeBtn) {
    (composeBtn as HTMLElement).click();
  } else {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
  }

  const toFieldDef = findSelector('TO_FIELD', GMAIL_SELECTORS);
  const composeWindow = await findElement(toFieldDef, 5000) as HTMLInputElement;

  composeWindow.focus();
  setNativeValue(composeWindow, to);
  composeWindow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  await sleep(300);

  const subjectDef = findSelector('SUBJECT', GMAIL_SELECTORS);
  let subjectField: Element | null = null;
  for (const sel of subjectDef.selectors) {
    subjectField = document.querySelector(sel);
    if (subjectField) break;
  }
  if (subjectField) {
    (subjectField as HTMLInputElement).focus();
    setNativeValue(subjectField as HTMLInputElement, subject);
  }
  await sleep(300);

  const bodyDef = findSelector('BODY', GMAIL_SELECTORS);
  let bodyField: Element | null = null;
  for (const sel of bodyDef.selectors) {
    bodyField = document.querySelector(sel);
    if (bodyField) break;
  }
  if (bodyField) {
    (bodyField as HTMLElement).focus();
    document.execCommand('selectAll');
    document.execCommand('insertText', false, body);
  }
  await sleep(500);

  const sendBtnDef = findSelector('SEND_BTN', GMAIL_SELECTORS);
  let sendBtn: Element | null = null;
  for (const sel of sendBtnDef.selectors) {
    sendBtn = document.querySelector(sel);
    if (sendBtn) break;
  }
  if (sendBtn) {
    (sendBtn as HTMLElement).click();
  } else {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  }

  await waitForElementGone(toFieldDef.selectors[0], 5000);
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

// ---- Bulk Email Job with Circuit Breaker ----

async function runEmailJob(contacts: Contact[], template: string, subject: string, settings: ExtensionSettings) {
  cancelRequested = false;
  const total = contacts.length;
  let sent = 0, failed = 0, consecutiveFailures = 0;

  const delayMap: Record<string, number> = { fast: 5000, normal: 10000, safe: 15000 };
  const baseDelay = settings.delayPreset === 'custom'
    ? settings.customDelaySeconds * 1000
    : (delayMap[settings.delayPreset] ?? 10000);

  for (let i = 0; i < contacts.length; i++) {
    if (cancelRequested) break;

    const contact = contacts[i];
    const to = contact.email ?? '';

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
      await withRetry(() => doSend(to, resolvedSubject, resolvedBody));
      sent++;
      consecutiveFailures = 0;
      await sendToBackground('INCREMENT_COUNT', { n: 1 });
      postProgress(i + 1, total, sent, failed, 'success', to);
    } catch (err) {
      failed++;
      consecutiveFailures++;
      postProgress(i + 1, total, sent, failed, 'error', to, String(err));

      if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        window.postMessage({
          type: 'BULK_SENDER_COMPLETE', sent, failed, skipped: total - sent - failed,
          halted: true, error: `Job halted — ${consecutiveFailures} consecutive failures. Last error: ${String(err)}`,
        }, '*');
        return;
      }
    }

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

async function handlePanelMessage(event: MessageEvent) {
  const data = event.data as { type: string; [key: string]: unknown };
  if (!data || !data.type) return;

  if (data.type === 'PREFLIGHT_CHECK') {
    const result = await runPreflight(GMAIL_SELECTORS);
    postToPanel({ type: 'PREFLIGHT_RESULT', ...result });
  } else if (data.type === 'START_EMAIL_JOB') {
    const { contacts, template, subject, settings } = data as unknown as {
      contacts: Contact[]; template: string; subject: string; settings: ExtensionSettings;
    };
    runEmailJob(contacts, template, subject, settings).catch((err) => {
      postToPanel({ type: 'JOB_START_ERROR', error: String(err) });
    });
  } else if (data.type === 'CANCEL_JOB') {
    cancelRequested = true;
  }
}

// ---- Init ----
injectPanel().catch((err) => notifyError(`Failed to load on Gmail: ${String(err)}`));
