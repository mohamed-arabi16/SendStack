import { SelectorError } from './selectors';

export const CIRCUIT_BREAKER_THRESHOLD = 3;
export const RETRY_ATTEMPTS = 2;
export const RETRY_BACKOFF_MS = 3000;

export function isRetryableError(err: unknown): boolean {
  if (err instanceof SelectorError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('not found')) return true;
  }
  return false;
}
