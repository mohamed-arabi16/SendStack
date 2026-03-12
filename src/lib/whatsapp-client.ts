import { Client, LocalAuth, type Message } from 'whatsapp-web.js';

type WAStatus = 'disconnected' | 'qr' | 'ready';

interface WAClientState {
  client: Client | null;
  status: WAStatus;
  qrString: string | null;
  info: { pushname?: string; wid?: string } | null;
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

export async function initialize(): Promise<void> {
  const state = getState();

  if (state.client && state.status !== 'disconnected') {
    // Already initialized — nothing to do
    return;
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
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
  state.status = 'disconnected';
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
    state.status = 'disconnected';
    state.qrString = null;
    state.client = null;
    console.error('[WhatsApp] Auth failure:', msg);
  });

  client.on('disconnected', (reason: string) => {
    state.status = 'disconnected';
    state.qrString = null;
    state.client = null;
    state.info = null;
    console.log('[WhatsApp] Disconnected:', reason);
  });

  client.on('message_ack', (msg: Message, ack: number) => {
    console.log(`[WhatsApp] Message ACK — id=${msg.id.id} ack=${ack}`);
  });

  await client.initialize();
}

export async function sendMessage(phone: string, text: string): Promise<string> {
  const state = getState();

  if (!state.client || state.status !== 'ready') {
    throw new Error('WhatsApp client is not ready');
  }

  const chatId = `${phone}@c.us`;
  const result = await state.client.sendMessage(chatId, text);
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
