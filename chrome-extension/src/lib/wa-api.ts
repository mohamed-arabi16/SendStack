/**
 * WA-API Bridge — content script side.
 * Injects wa-bridge.js into WhatsApp Web's main world,
 * then provides openChat() which communicates via postMessage.
 */

const ORIGIN = 'https://web.whatsapp.com';

let bridgeReady = false;
let bridgeFailed = false;
let bridgeError = '';
let bridgeInitStarted = false;
let requestId = 0;

/**
 * Inject the WA-JS bridge into WhatsApp Web's main world.
 * Returns true if the bridge initialized successfully.
 * Idempotent — safe to call multiple times.
 */
export async function initBridge(): Promise<boolean> {
  if (bridgeReady) return true;
  if (bridgeFailed) return false;
  if (bridgeInitStarted) return false; // prevent double init
  bridgeInitStarted = true;

  // Inject the bridge script into the page's main world
  const bridgeScript = document.createElement('script');
  bridgeScript.src = chrome.runtime.getURL('wa-bridge.js');
  document.head.appendChild(bridgeScript);

  // Wait for bridge script to load
  await new Promise<void>((resolve) => {
    bridgeScript.onload = () => resolve();
    bridgeScript.onerror = () => resolve();
  });

  // Tell the bridge to load WA-JS (only accept chrome-extension:// URLs)
  const waJsUrl = chrome.runtime.getURL('wppconnect-wa.js');
  window.postMessage({ type: 'WA_INIT', waJsUrl }, ORIGIN);

  // Wait for bridge ready/failed (up to 35 seconds)
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      bridgeFailed = true;
      bridgeError = 'Bridge initialization timeout';
      resolve(false);
    }, 35000);

    function onMessage(event: MessageEvent) {
      if (event.origin !== ORIGIN) return;
      if (event.data?.type === 'WA_BRIDGE_READY') {
        clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        bridgeReady = true;
        resolve(true);
      } else if (event.data?.type === 'WA_BRIDGE_FAILED') {
        clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        bridgeFailed = true;
        bridgeError = event.data.error || 'Unknown error';
        resolve(false);
      }
    }

    window.addEventListener('message', onMessage);
  });
}

/**
 * Open a chat with the given phone number via WA-JS internal API.
 * No page reload — chat switches inline within WhatsApp Web's SPA.
 *
 * @throws Error if bridge not ready or chat open fails
 */
export async function openChat(phone: string): Promise<void> {
  if (!bridgeReady) {
    throw new Error(bridgeFailed ? `WA-JS bridge failed: ${bridgeError}` : 'WA-JS bridge not initialized');
  }

  const id = `req-${++requestId}-${Date.now()}`;

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error(`openChat timeout for ${phone}`));
    }, 10000);

    function onMessage(event: MessageEvent) {
      if (event.origin !== ORIGIN) return;
      if (event.data?.type === 'WA_CHAT_RESULT' && event.data?.id === id) {
        clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        if (event.data.success) {
          resolve();
        } else {
          reject(new Error(event.data.error || `Failed to open chat with ${phone}`));
        }
      }
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'WA_OPEN_CHAT', phone, id }, ORIGIN);
  });
}

/**
 * Check if the bridge is ready.
 */
export function isBridgeReady(): boolean {
  return bridgeReady;
}
