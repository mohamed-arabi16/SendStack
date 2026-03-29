/**
 * WA-JS Bridge — runs in WhatsApp Web's MAIN world.
 * Injected by the content script via <script> tag.
 * Communicates with the content script via window.postMessage.
 */
(function () {
  'use strict';

  // Prevent double injection
  if (window.__WA_BRIDGE_LOADED) return;
  window.__WA_BRIDGE_LOADED = true;

  var ORIGIN = 'https://web.whatsapp.com';
  var wppReady = false;
  var wppFailed = false;

  function loadWaJs(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Failed to load WA-JS')); };
      document.head.appendChild(script);
    });
  }

  async function init(waJsUrl) {
    try {
      await loadWaJs(waJsUrl);

      // Wait for WPP to be ready (up to 30 seconds)
      for (var i = 0; i < 60; i++) {
        if (window.WPP && window.WPP.isReady) {
          wppReady = true;
          window.postMessage({ type: 'WA_BRIDGE_READY', source: 'wa-bridge' }, ORIGIN);
          return;
        }
        await new Promise(function (r) { setTimeout(r, 500); });
      }

      wppFailed = true;
      window.postMessage({ type: 'WA_BRIDGE_FAILED', error: 'WPP not ready after 30s', source: 'wa-bridge' }, ORIGIN);
    } catch (err) {
      wppFailed = true;
      window.postMessage({ type: 'WA_BRIDGE_FAILED', error: String(err), source: 'wa-bridge' }, ORIGIN);
    }
  }

  window.addEventListener('message', async function (event) {
    // Only accept messages from our own origin
    if (event.origin !== ORIGIN) return;
    if (!event.data || event.data.source === 'wa-bridge') return;

    if (event.data.type === 'WA_INIT') {
      var url = event.data.waJsUrl;
      // Only load scripts from chrome-extension:// URLs
      if (typeof url !== 'string' || !url.startsWith('chrome-extension://')) return;
      init(url);
      return;
    }

    if (event.data.type === 'WA_OPEN_CHAT') {
      if (!wppReady) {
        window.postMessage({
          type: 'WA_CHAT_RESULT',
          id: event.data.id,
          success: false,
          error: wppFailed ? 'WA-JS failed to initialize' : 'WA-JS not ready yet',
          source: 'wa-bridge'
        }, ORIGIN);
        return;
      }

      var phone = event.data.phone;
      var wid = phone.replace(/[\s\-+]/g, '') + '@c.us';

      try {
        if (typeof window.WPP.chat.openChatBottom === 'function') {
          await window.WPP.chat.openChatBottom(wid);
        } else if (typeof window.WPP.chat.find === 'function') {
          await window.WPP.chat.find(wid);
        } else {
          throw new Error('No suitable WPP.chat function available');
        }

        window.postMessage({
          type: 'WA_CHAT_RESULT',
          id: event.data.id,
          success: true,
          source: 'wa-bridge'
        }, ORIGIN);
      } catch (err) {
        window.postMessage({
          type: 'WA_CHAT_RESULT',
          id: event.data.id,
          success: false,
          error: String(err.message || err),
          source: 'wa-bridge'
        }, ORIGIN);
      }
    }
  });
})();
