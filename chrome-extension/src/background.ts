/**
 * Background service worker — coordinates all extension logic.
 */

import type { ExtensionSettings, Job } from './lib/storage';
import { getSettings, saveSettings, getDailyCount, incrementCount, resetCount } from './lib/storage';

const jobs = new Map<string, Job>();

// Set default settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  if (!settings) {
    await saveSettings({
      defaultMode: 'email',
      delayPreset: 'normal',
      customDelaySeconds: 10,
      jitterEnabled: true,
      batchSize: 10,
      cooldownSeconds: 60,
      dailyLimit: 200,
      spinSyntaxEnabled: true,
      sidebarPosition: 'right',
    });
  }
  // Set up midnight reset alarm
  chrome.alarms.create('resetDailyCount', {
    when: nextMidnight(),
    periodInMinutes: 24 * 60,
  });
});

// Reset daily counter at midnight
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'resetDailyCount') {
    resetCount();
    chrome.alarms.create('resetDailyCount', {
      when: nextMidnight(),
      periodInMinutes: 24 * 60,
    });
  }
});

function nextMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

// Message passing hub
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err: Error) => sendResponse({ error: err.message }));
  return true; // keep channel open for async
});

async function handleMessage(message: { action: string; payload?: Record<string, unknown> }): Promise<unknown> {
  switch (message.action) {
    case 'GET_SETTINGS':
      return getSettings();
    case 'SAVE_SETTINGS':
      await saveSettings(message.payload as unknown as ExtensionSettings);
      return { ok: true };
    case 'GET_DAILY_COUNT': {
      const { sent, limit } = await getDailyCount();
      return { sent, limit };
    }
    case 'INCREMENT_COUNT': {
      const n = (message.payload as { n: number }).n;
      const newTotal = await incrementCount(n);
      return { newTotal };
    }
    case 'RESET_COUNT':
      await resetCount();
      return { ok: true };
    case 'START_JOB': {
      const job = message.payload as unknown as Job;
      jobs.set(job.jobId, { ...job, status: 'running' });
      return { ok: true };
    }
    case 'CANCEL_JOB': {
      const { jobId } = message.payload as { jobId: string };
      const job = jobs.get(jobId);
      if (job) { job.status = 'cancelled'; jobs.set(jobId, job); }
      return { ok: true };
    }
    default:
      return { error: `Unknown action: ${message.action}` };
  }
}
