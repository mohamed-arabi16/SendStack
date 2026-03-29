export type MessageAction =
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'GET_DAILY_COUNT'
  | 'INCREMENT_COUNT'
  | 'RESET_COUNT'
  | 'START_JOB'
  | 'CANCEL_JOB'
  | 'STORE_WA_JOB'
  | 'GET_ACTIVE_WA_JOB'
  | 'ADVANCE_WA_JOB'
  | 'CANCEL_WA_JOB'
  | 'FIRE_NOTIFICATION';

export function sendToBackground<T = unknown>(
  action: MessageAction,
  payload?: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, payload }, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
