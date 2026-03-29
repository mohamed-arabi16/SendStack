import { resolveTemplate, resolveSpin, applyJitter, sleep } from './lib/csv-parser';
import type { Contact } from './lib/csv-parser';
import { sendToBackground } from './lib/messaging';
import type { ExtensionSettings } from './lib/storage';
import type { WaJobState } from './background';
import { findElement, findSelector, runPreflight, SelectorError, WHATSAPP_SELECTORS } from './lib/selectors';
import { CIRCUIT_BREAKER_THRESHOLD, RETRY_ATTEMPTS, RETRY_BACKOFF_MS, isRetryableError } from './lib/circuit-breaker';

let panelVisible = false;
let shadowHost: HTMLDivElement | null = null;
let panelIframe: HTMLIFrameElement | null = null;

function notifyError(message: string) {
  sendToBackground('FIRE_NOTIFICATION', { title: 'SendStack', message }).catch(() => {});
}

function postToPanel(data: Record<string, unknown>) {
  panelIframe?.contentWindow?.postMessage(data, '*');
}

async function injectPanel() {
  if (window.location.search.includes('phone=')) {
    await processCurrentContact();
    return;
  }

  // Wait for WhatsApp to load (non-blocking — inject panel regardless)
  try {
    await findElement(findSelector('CHAT_LIST', WHATSAPP_SELECTORS), 20000);
  } catch {
    // Will be caught by pre-flight check in panel
  }

  // Floating toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'bulk-sender-toggle';
  toggleBtn.textContent = '\uD83D\uDCAC Bulk Sender';
  toggleBtn.style.cssText = [
    'position:fixed', 'right:0', 'top:50%', 'transform:translateY(-50%)',
    'z-index:99999', 'background:#25d366', 'color:#fff', 'border:none',
    'border-radius:8px 0 0 8px', 'padding:12px 10px', 'cursor:pointer',
    'font-size:13px', 'font-family:sans-serif', 'writing-mode:vertical-rl',
    'text-orientation:mixed', 'box-shadow:-2px 0 8px rgba(0,0,0,0.2)',
  ].join(';');
  toggleBtn.addEventListener('click', togglePanel);
  document.body.appendChild(toggleBtn);

  // Shadow DOM host
  shadowHost = document.createElement('div');
  shadowHost.id = 'bulk-sender-panel-host';
  shadowHost.style.cssText = [
    'position:fixed', 'right:0', 'top:0', 'height:100vh', 'width:420px',
    'z-index:99998', 'display:none', 'box-shadow:-4px 0 20px rgba(0,0,0,0.15)',
  ].join(';');
  document.body.appendChild(shadowHost);

  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('panel.html') + '?mode=whatsapp';
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.onerror = () => notifyError('Panel failed to load on WhatsApp Web');
  shadowRoot.appendChild(iframe);
  panelIframe = iframe;

  window.addEventListener('message', handlePanelMessage);
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

// ---- Process the current contact on a /send?phone=... page ----

async function processCurrentContact(): Promise<void> {
  const job = await sendToBackground<WaJobState | null>('GET_ACTIVE_WA_JOB');
  if (!job || job.status !== 'running') return;

  const contact = job.contacts[job.currentIndex];
  if (!contact) return;

  const phone = contact.phone ?? '';
  const total = job.contacts.length;
  let sent = job.sent;
  let failed = job.failed;
  let consecutiveFailures = job.consecutiveFailures ?? 0;

  // Enforce daily limit
  const { sent: dailySent, limit: dailyLimit } =
    await sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT');
  if (dailySent >= dailyLimit) {
    await sendToBackground('CANCEL_WA_JOB', {});
    notifyError(`Daily limit reached (${dailyLimit}). Job stopped after ${sent} sent.`);
    return;
  }

  let resolvedMsg = resolveTemplate(job.template, contact);
  if (job.settings.spinSyntaxEnabled) resolvedMsg = resolveSpin(resolvedMsg);

  try {
    await withRetry(() => doSendOnCurrentPage(phone, resolvedMsg));
    sent++;
    consecutiveFailures = 0;
    await sendToBackground('INCREMENT_COUNT', { n: 1 });
  } catch (err) {
    failed++;
    consecutiveFailures++;

    // Circuit breaker check
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      const errorMsg = err instanceof SelectorError
        ? `${err.selectorName} not found — WhatsApp may have changed its UI`
        : String(err);
      const haltedJob: WaJobState = {
        ...job, sent, failed, consecutiveFailures,
        status: 'halted', lastError: errorMsg,
      };
      await sendToBackground('STORE_WA_JOB', haltedJob as unknown as Record<string, unknown>);
      notifyError(`Job halted after ${sent}/${total} — ${errorMsg}`);
      return;
    }
  }

  // Advance job in background
  const { nextIndex, status } =
    await sendToBackground<{ nextIndex: number; status: WaJobState['status'] }>('ADVANCE_WA_JOB', { sent, failed, consecutiveFailures });

  if (status === 'completed' || status === 'cancelled') return;

  // Inter-message delay
  const batchSize = job.settings.batchSize;
  if (nextIndex % batchSize === 0) {
    await sleep(job.settings.cooldownSeconds * 1000);
  } else {
    const delayMap: Record<string, number> = { fast: 5000, normal: 10000, safe: 15000 };
    const base = job.settings.delayPreset === 'custom'
      ? job.settings.customDelaySeconds * 1000
      : (delayMap[job.settings.delayPreset] ?? 10000);
    const delay = job.settings.jitterEnabled ? applyJitter(base) : base;
    await sleep(delay);
  }

  // Navigate to next contact
  const nextContact = job.contacts[nextIndex];
  const nextPhone = nextContact?.phone?.replace(/[\s\-+]/g, '') ?? '';
  if (nextPhone) {
    window.location.href = `https://web.whatsapp.com/send?phone=${nextPhone}`;
  }
}

// ---- WhatsApp send interaction on the current page ----

async function doSendOnCurrentPage(phone: string, message: string): Promise<void> {
  const msgInputDef = findSelector('MSG_INPUT', WHATSAPP_SELECTORS);
  const input = await findElement(msgInputDef, 20000) as HTMLElement;

  await sleep(1000);
  const invalidPhoneDef = findSelector('INVALID_PHONE', WHATSAPP_SELECTORS);
  for (const sel of invalidPhoneDef.selectors) {
    const invalidMsg = document.querySelector(sel);
    if (invalidMsg?.textContent?.includes('Phone number shared via url is invalid')) {
      throw new Error(`Phone ${phone} is not on WhatsApp`);
    }
  }

  input.focus();
  document.execCommand('insertText', false, message);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(300);

  const sendBtnDef = findSelector('SEND_BUTTON', WHATSAPP_SELECTORS);
  let sendBtn: Element | null = null;
  for (const sel of sendBtnDef.selectors) {
    sendBtn = document.querySelector(sel);
    if (sendBtn) break;
  }
  if (sendBtn) {
    (sendBtn as HTMLElement).click();
  } else {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  await sleep(500);
}

// ---- Panel message handler (main page only) ----

async function handlePanelMessage(event: MessageEvent) {
  const data = event.data as { type: string; [key: string]: unknown };
  if (!data || !data.type) return;

  if (data.type === 'PREFLIGHT_CHECK') {
    const result = await runPreflight(WHATSAPP_SELECTORS);
    postToPanel({ type: 'PREFLIGHT_RESULT', ...result });
  } else if (data.type === 'START_WA_JOB') {
    const { contacts, template, settings } = data as unknown as {
      contacts: Contact[]; template: string; settings: ExtensionSettings;
    };
    startWaJob(contacts, template, settings).catch((err) => {
      postToPanel({ type: 'JOB_START_ERROR', error: String(err) });
    });
  } else if (data.type === 'CANCEL_JOB') {
    sendToBackground('CANCEL_WA_JOB', {}).catch((err) => notifyError(String(err)));
  }
}

async function startWaJob(contacts: Contact[], template: string, settings: ExtensionSettings): Promise<void> {
  const jobId = `wa-${Date.now()}`;
  const job: WaJobState = {
    jobId, contacts, template, settings,
    currentIndex: 0, sent: 0, failed: 0, status: 'running',
    consecutiveFailures: 0, lastError: '',
  };
  await sendToBackground('STORE_WA_JOB', job as unknown as Record<string, unknown>);

  const firstPhone = contacts[0]?.phone?.replace(/[\s\-+]/g, '') ?? '';
  if (firstPhone) {
    window.location.href = `https://web.whatsapp.com/send?phone=${firstPhone}`;
  }
}

injectPanel().catch((err) => notifyError(`Failed to load on WhatsApp Web: ${String(err)}`));
