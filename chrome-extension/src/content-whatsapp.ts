import { resolveTemplate, resolveSpin, applyJitter, sleep } from './lib/csv-parser';
import type { Contact } from './lib/csv-parser';
import { sendToBackground } from './lib/messaging';
import type { ExtensionSettings } from './lib/storage';

let panelVisible = false;
let shadowHost: HTMLDivElement | null = null;
let cancelRequested = false;

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

// ---- WhatsApp send automation ----

async function sendViaWhatsAppWeb(phone: string, message: string): Promise<void> {
  const normalizedPhone = phone.replace(/[\s\-+]/g, '');

  // Navigate to the chat
  const chatUrl = `https://web.whatsapp.com/send?phone=${normalizedPhone}`;
  window.location.href = chatUrl;

  // Wait for message input to appear
  const input = await waitForElement('footer [contenteditable="true"]', 20000) as HTMLElement;

  // Check if the number is invalid (WhatsApp shows an error)
  await sleep(3000);
  const invalidMsg = document.querySelector('[data-testid="intro-text"]');
  if (invalidMsg?.textContent?.includes('Phone number shared via url is invalid')) {
    throw new Error(`Phone ${phone} is not on WhatsApp`);
  }

  // Type the message
  input.focus();
  document.execCommand('insertText', false, message);
  input.dispatchEvent(new Event('input', { bubbles: true }));

  await sleep(500);

  // Press Enter or click send button
  const sendBtn = document.querySelector('[data-testid="send"], [aria-label="Send"]') as HTMLElement | null;
  if (sendBtn) {
    sendBtn.click();
  } else {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  await sleep(1000);
}

// ---- Bulk WhatsApp Job ----

async function runWhatsAppJob(contacts: Contact[], template: string, settings: ExtensionSettings) {
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
    const phone = contact.phone ?? '';
    if (!phone) {
      failed++;
      postProgress(i + 1, total, sent, failed, 'skipped', phone, 'No phone number');
      continue;
    }

    let resolvedMsg = resolveTemplate(template, contact);
    if (settings.spinSyntaxEnabled) resolvedMsg = resolveSpin(resolvedMsg);

    try {
      await sendViaWhatsAppWeb(phone, resolvedMsg);
      sent++;
      await sendToBackground('INCREMENT_COUNT', { n: 1 });
      postProgress(i + 1, total, sent, failed, 'success', phone);
    } catch (err) {
      failed++;
      postProgress(i + 1, total, sent, failed, 'error', phone, String(err));
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

function handlePanelMessage(event: MessageEvent) {
  const data = event.data as { type: string; [key: string]: unknown };
  if (!data || !data.type) return;

  if (data.type === 'START_WA_JOB') {
    const { contacts, template, settings } = data as unknown as {
      contacts: Contact[]; template: string; settings: ExtensionSettings;
    };
    runWhatsAppJob(contacts, template, settings).catch(console.error);
  } else if (data.type === 'CANCEL_JOB') {
    cancelRequested = true;
  }
}

injectPanel().catch(console.error);
