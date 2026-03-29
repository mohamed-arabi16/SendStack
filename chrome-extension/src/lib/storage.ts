export interface ExtensionSettings {
  defaultMode: 'email' | 'whatsapp';
  delayPreset: 'fast' | 'normal' | 'safe' | 'custom';
  customDelaySeconds: number;
  jitterEnabled: boolean;
  batchSize: number;
  cooldownSeconds: number;
  dailyLimit: number;
  spinSyntaxEnabled: boolean;
  sidebarPosition: 'left' | 'right';
}

export interface Job {
  jobId: string;
  contacts: Record<string, string>[];
  template: string;
  mode: 'email' | 'whatsapp';
  status?: 'running' | 'cancelled' | 'completed';
}

const SETTINGS_KEY = 'extensionSettings';
const DAILY_KEY = 'dailyCount';
const DAILY_DATE_KEY = 'dailyDate';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultMode: 'email',
  delayPreset: 'normal',
  customDelaySeconds: 10,
  jitterEnabled: true,
  batchSize: 10,
  cooldownSeconds: 60,
  dailyLimit: 200,
  spinSyntaxEnabled: true,
  sidebarPosition: 'right',
};

export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(SETTINGS_KEY, (result) => {
      resolve((result[SETTINGS_KEY] as ExtensionSettings) ?? DEFAULT_SETTINGS);
    });
  });
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [SETTINGS_KEY]: settings }, resolve);
  });
}

export async function getDailyCount(): Promise<{ sent: number; limit: number }> {
  const settings = await getSettings(); // reads from sync storage
  return new Promise((resolve) => {
    chrome.storage.local.get([DAILY_KEY, DAILY_DATE_KEY], (result) => {
      const today = new Date().toDateString();
      const storedDate = result[DAILY_DATE_KEY] as string | undefined;
      const sent = storedDate === today ? ((result[DAILY_KEY] as number) ?? 0) : 0;
      resolve({ sent, limit: settings.dailyLimit });
    });
  });
}

export async function incrementCount(n: number): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage.local.get([DAILY_KEY, DAILY_DATE_KEY], (result) => {
      const today = new Date().toDateString();
      const storedDate = result[DAILY_DATE_KEY] as string | undefined;
      const current = storedDate === today ? ((result[DAILY_KEY] as number) ?? 0) : 0;
      const newTotal = current + n;
      chrome.storage.local.set({ [DAILY_KEY]: newTotal, [DAILY_DATE_KEY]: today }, () => {
        resolve(newTotal);
      });
    });
  });
}

export async function resetCount(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [DAILY_KEY]: 0, [DAILY_DATE_KEY]: new Date().toDateString() }, resolve);
  });
}
