import fs from 'fs';
import os from 'os';
import path from 'path';
import { Client, LocalAuth, MessageMedia, type Message } from 'whatsapp-web.js';

export type WAStatus = 'disconnected' | 'reconnecting' | 'qr' | 'ready';

/** ACK level from whatsapp-web.js message_ack event */
export type AckStatus = 0 | 1 | 2 | 3;

interface WAClientState {
  client: Client | null;
  status: WAStatus;
  qrString: string | null;
  info: { pushname?: string; wid?: string } | null;
  /** messageId → latest ACK level */
  ackMap: Map<string, AckStatus>;
  /** Last initialization error message, if any */
  lastError: string | null;
}

// Use globalThis to survive Next.js hot-reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __waClientState: WAClientState | undefined;
}

function getState(): WAClientState {
  if (!globalThis.__waClientState) {
    globalThis.__waClientState = {
      client: null,
      status: 'disconnected',
      qrString: null,
      info: null,
      ackMap: new Map(),
      lastError: null,
    };
  }
  return globalThis.__waClientState;
}

export function getStatus(): WAStatus {
  return getState().status;
}

export function getQR(): string | null {
  return getState().qrString;
}

export function getClientInfo(): { pushname?: string; wid?: string } | null {
  return getState().info;
}

/** Returns the last initialization error message, or null if there was no error. */
export function getError(): string | null {
  return getState().lastError;
}

/** Returns the latest ACK level for a given message ID, or null if not tracked. */
export function getAckStatus(messageId: string): AckStatus | null {
  return getState().ackMap.get(messageId) ?? null;
}

/**
 * Returns the full ACK map snapshot as a plain object.
 * Used by the /api/whatsapp/ack route.
 */
export function getAllAcks(): Record<string, AckStatus> {
  return Object.fromEntries(getState().ackMap.entries());
}

// Use os.tmpdir() so this path is always writable — both in local dev and in
// serverless/Lambda environments where the project root (/var/task) is read-only.
const AUTH_PATH = path.join(os.tmpdir(), '.wwebjs_auth');
// LocalAuth without a clientId stores the session at `{dataPath}/session`
const SESSION_DIR = path.join(AUTH_PATH, 'session');

/** Check whether a persisted LocalAuth session exists on disk. */
export function isSessionSaved(): boolean {
  try {
    return fs.existsSync(SESSION_DIR);
  } catch {
    return false;
  }
}

/**
 * Remove the persisted LocalAuth session from disk so the next
 * `initialize()` call will start a fresh QR-code flow.
 */
export function clearSavedSession(): void {
  try {
    if (fs.existsSync(AUTH_PATH)) {
      fs.rmSync(AUTH_PATH, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('[WhatsApp] Failed to clear saved session:', err);
  }
}

/**
 * Remove stale Puppeteer singleton lock/socket files left behind by a
 * previous browser instance that was killed without a clean shutdown.
 * Without this cleanup, Puppeteer refuses to launch with
 * "The browser is already running for <path>".
 */
function clearPuppeteerLocks(userDataDir: string): void {
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
  for (const name of lockFiles) {
    const filePath = path.join(userDataDir, name);
    try {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
        console.log(`[WhatsApp] Removed stale lock file: ${filePath}`);
      }
    } catch (err) {
      console.warn(`[WhatsApp] Could not remove lock file ${filePath}:`, err);
    }
  }
}

/**
 * Auto-initialise the client when a saved session exists and the client
 * is currently disconnected.  This is called by the status endpoint so
 * that a page reload after a server restart reconnects automatically.
 */
export function autoInit(): void {
  const state = getState();
  if (state.status === 'disconnected' && isSessionSaved()) {
    state.status = 'reconnecting';
    state.lastError = null;
    initialize().catch((err: Error) => {
      console.error('[WhatsApp] Auto-reconnect failed:', err);
      state.status = 'disconnected';
      state.lastError = err.message;
    });
  }
}

export async function initialize(): Promise<void> {
  const state = getState();

  if (state.client && state.status !== 'disconnected' && state.status !== 'reconnecting') {
    // Already initialized — nothing to do
    return;
  }

  // Clear any previous error
  state.lastError = null;

  // If a saved session exists, show 'reconnecting' so the UI can give appropriate feedback
  if (state.status === 'disconnected' && isSessionSaved()) {
    state.status = 'reconnecting';
  }

  // Ensure the auth directory exists before LocalAuth tries to create sub-directories.
  // This is essential in serverless environments (e.g. Vercel/Lambda) where only
  // os.tmpdir() (/tmp) is writable — the directory may not exist yet on a cold start.
  try {
    fs.mkdirSync(AUTH_PATH, { recursive: true });
  } catch (err) {
    console.warn('[WhatsApp] Could not pre-create auth directory:', err);
  }

  // Clean up stale Puppeteer singleton lock files left over from a previous
  // browser instance that was killed without a clean shutdown.  Without this,
  // Puppeteer refuses to launch with "The browser is already running for <path>".
  clearPuppeteerLocks(SESSION_DIR);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_PATH }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  state.client = client;
  state.qrString = null;
  state.info = null;

  client.on('qr', (qr: string) => {
    state.qrString = qr;
    state.status = 'qr';
    console.log('[WhatsApp] QR code received');
  });

  client.on('authenticated', () => {
    state.qrString = null;
    console.log('[WhatsApp] Authenticated');
  });

  client.on('ready', () => {
    state.status = 'ready';
    state.qrString = null;
    const info = client.info;
    if (info) {
      state.info = {
        pushname: info.pushname,
        wid: info.wid?.user,
      };
    }
    console.log('[WhatsApp] Client is ready');
  });

  client.on('auth_failure', (msg: string) => {
    console.error('[WhatsApp] Auth failure:', msg);
    // Always reset state first so the client is usable again regardless of session-clear outcome
    state.status = 'disconnected';
    state.lastError = msg;
    state.qrString = null;
    state.client = null;
    // Clear saved session so next connect starts a fresh QR flow
    clearSavedSession();
  });

  client.on('disconnected', (reason: string) => {
    state.status = 'disconnected';
    state.qrString = null;
    state.client = null;
    state.info = null;
    console.log('[WhatsApp] Disconnected:', reason);
  });

  client.on('message_ack', (msg: Message, ack: number) => {
    state.ackMap.set(msg.id.id, ack as AckStatus);
    console.log(`[WhatsApp] Message ACK — id=${msg.id.id} ack=${ack}`);
  });

  try {
    await client.initialize();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[WhatsApp] client.initialize() failed:', message);
    state.status = 'disconnected';
    state.lastError = message;
    state.client = null;
    throw err;
  }
}

/** Validate and normalize a phone number. Returns normalized digits or throws. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[\s\-\(\)\+]/g, '');
  if (!/^\d{7,15}$/.test(digits)) {
    throw new Error(`Invalid phone number format: "${phone}". Expected 7–15 digits.`);
  }
  return digits;
}

/**
 * Send a text message to a phone number (E.164 format without '+').
 * Retries up to 3 times with exponential backoff (5s → 10s → 20s) on transient errors.
 */
export async function sendMessage(phone: string, text: string): Promise<string> {
  const state = getState();

  if (!state.client || state.status !== 'ready') {
    throw new Error('WhatsApp client is not ready');
  }

  const chatId = `${phone}@c.us`;

  let lastError: Error | null = null;
  const backoffMs = [5000, 10000, 20000];

  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    try {
      const result = await state.client.sendMessage(chatId, text);
      return result.id.id;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const errorMsg = lastError.message.toLowerCase();

      // Don't retry on permanent errors (number not found, etc.)
      if (errorMsg.includes('not registered') || errorMsg.includes('invalid wid')) {
        throw lastError;
      }

      // Check if client disconnected mid-send
      if (state.status !== 'ready') {
        throw new Error('WhatsApp client disconnected during send');
      }

      if (attempt < backoffMs.length) {
        const delay = backoffMs[attempt];
        console.warn(`[WhatsApp] Send failed (attempt ${attempt + 1}), retrying in ${delay / 1000}s…`, lastError.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error('Failed to send message after retries');
}

/**
 * Send a media message (image / document) with an optional caption.
 *
 * @param phone      - Phone number digits (no '+' or spaces)
 * @param mediaBase64 - Base64-encoded file content
 * @param mimeType   - MIME type, e.g. 'image/png', 'application/pdf'
 * @param filename   - Original filename shown in WhatsApp
 * @param caption    - Optional text caption
 */
export async function sendMedia(
  phone: string,
  mediaBase64: string,
  mimeType: string,
  filename: string,
  caption?: string,
): Promise<string> {
  const state = getState();

  if (!state.client || state.status !== 'ready') {
    throw new Error('WhatsApp client is not ready');
  }

  const chatId = `${phone}@c.us`;
  const media = new MessageMedia(mimeType, mediaBase64, filename);

  const result = await state.client.sendMessage(chatId, media, { caption });
  return result.id.id;
}

export async function isRegisteredUser(phone: string): Promise<boolean> {
  const state = getState();

  if (!state.client || state.status !== 'ready') {
    throw new Error('WhatsApp client is not ready');
  }

  const chatId = `${phone}@c.us`;
  return state.client.isRegisteredUser(chatId);
}

export async function disconnect(): Promise<void> {
  const state = getState();

  if (!state.client) {
    return;
  }

  try {
    await state.client.destroy();
  } finally {
    state.client = null;
    state.status = 'disconnected';
    state.qrString = null;
    state.info = null;
  }
}
