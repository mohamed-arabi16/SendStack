import { resolveTemplate, resolveSpin, applyJitter, sleep } from './lib/csv-parser';
import type { Contact } from './lib/csv-parser';
import { sendToBackground } from './lib/messaging';
import type { ExtensionSettings } from './lib/storage';
import type { WaJobState } from './background';

let panelVisible = false;
let shadowHost: HTMLDivElement | null = null;

function waitForElement(selector: string, timeout = 15000): Promise<Element> {
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
  // If we are on a /send?phone=... page, resume the active bulk job and skip panel setup.
  if (window.location.search.includes('phone=')) {
    await processCurrentContact();
    return;
  }

  // ---- Normal main-page panel injection ----
  try {
    await waitForElement('#pane-side', 20000);
  } catch {
    console.warn('[BulkSender] WhatsApp chat list not found, injecting anyway');
  }

  // Floating toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'bulk-sender-toggle';
  toggleBtn.textContent = '💬 Bulk Sender';
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
  shadowRoot.appendChild(iframe);

  window.addEventListener('message', handlePanelMessage);
}

function togglePanel() {
  panelVisible = !panelVisible;
  if (shadowHost) {
    shadowHost.style.display = panelVisible ? 'block' : 'none';
  }
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

  // Enforce daily limit
  const { sent: dailySent, limit: dailyLimit } =
    await sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT');
  if (dailySent >= dailyLimit) {
    window.postMessage({
      type: 'BULK_SENDER_PROGRESS', current: job.currentIndex + 1, total,
      sent, failed, status: 'skipped', recipient: phone, error: 'Daily limit reached',
    }, '*');
    await sendToBackground('CANCEL_WA_JOB', {});
    window.postMessage({ type: 'BULK_SENDER_COMPLETE', sent, failed, skipped: total - job.currentIndex }, '*');
    return;
  }

  let resolvedMsg = resolveTemplate(job.template, contact);
  if (job.settings.spinSyntaxEnabled) resolvedMsg = resolveSpin(resolvedMsg);

  try {
    await doSendOnCurrentPage(phone, resolvedMsg);
    sent++;
    await sendToBackground('INCREMENT_COUNT', { n: 1 });
    window.postMessage({
      type: 'BULK_SENDER_PROGRESS', current: job.currentIndex + 1, total,
      sent, failed, status: 'success', recipient: phone,
    }, '*');
  } catch (err) {
    failed++;
    window.postMessage({
      type: 'BULK_SENDER_PROGRESS', current: job.currentIndex + 1, total,
      sent, failed, status: 'error', recipient: phone, error: String(err),
    }, '*');
  }

  // Advance job in background
  const { nextIndex, status } =
    await sendToBackground<{ nextIndex: number; status: WaJobState['status'] }>('ADVANCE_WA_JOB', { sent, failed });

  if (status === 'completed' || status === 'cancelled') {
    window.postMessage({ type: 'BULK_SENDER_COMPLETE', sent, failed, skipped: total - sent - failed }, '*');
    return;
  }

  // Inter-message delay
  const batchSize = job.settings.batchSize;
  if (nextIndex % batchSize === 0) {
    window.postMessage({ type: 'BULK_SENDER_COOLDOWN', seconds: job.settings.cooldownSeconds }, '*');
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
  if (nextContact?.phone) {
    const nextPhone = nextContact.phone.replace(/[\s\-+]/g, '');
    window.location.href = `https://web.whatsapp.com/send?phone=${nextPhone}`;
  }
}

// ---- WhatsApp send interaction on the current page ----

async function doSendOnCurrentPage(phone: string, message: string): Promise<void> {
  const input = await waitForElement('footer [contenteditable="true"]', 20000) as HTMLElement;

  await sleep(1000);
  const invalidMsg = document.querySelector('[data-testid="intro-text"]');
  if (invalidMsg?.textContent?.includes('Phone number shared via url is invalid')) {
    throw new Error(`Phone ${phone} is not on WhatsApp`);
  }

  input.focus();
  document.execCommand('insertText', false, message);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(300);

  const sendBtn = document.querySelector('[data-testid="send"], [aria-label="Send"]') as HTMLElement | null;
  if (sendBtn) {
    sendBtn.click();
  } else {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  await sleep(500);
}

// ---- Panel message handler (main page only) ----

function handlePanelMessage(event: MessageEvent) {
  const data = event.data as { type: string; [key: string]: unknown };
  if (!data || !data.type) return;

  if (data.type === 'START_WA_JOB') {
    const { contacts, template, settings } = data as unknown as {
      contacts: Contact[]; template: string; settings: ExtensionSettings;
    };
    startWaJob(contacts, template, settings).catch(console.error);
  } else if (data.type === 'CANCEL_JOB') {
    sendToBackground('CANCEL_WA_JOB', {}).catch(console.error);
  }
}

async function startWaJob(contacts: Contact[], template: string, settings: ExtensionSettings): Promise<void> {
  const jobId = `wa-${Date.now()}`;
  const job: WaJobState = {
    jobId, contacts, template, settings,
    currentIndex: 0, sent: 0, failed: 0, status: 'running',
  };
  await sendToBackground('STORE_WA_JOB', job as unknown as Record<string, unknown>);

  // Navigate to the first contact's send URL
  const firstPhone = contacts[0]?.phone?.replace(/[\s\-+]/g, '') ?? '';
  if (firstPhone) {
    window.location.href = `https://web.whatsapp.com/send?phone=${firstPhone}`;
  }
}

injectPanel().catch(console.error);
