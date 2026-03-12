/**
 * Resolve spin syntax: {option1|option2|option3} → one random option per occurrence.
 * Uses single curly braces with pipes — distinct from {{Variable}} template syntax.
 * Example: "{Hi|Hello|Hey} {{Name}}!" → "Hello John!"
 */
export function resolveSpin(template: string): string {
  return template.replace(/\{([^{}|]+(?:\|[^{}|]+)+)\}/g, (_, options: string) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

/**
 * Apply ±jitter to a base delay.
 * Actual delay = baseDelay + random(−30 %, +50 %) of base delay.
 * The result is always at least 3 000 ms (3 seconds).
 */
export function applyJitter(baseDelayMs: number): number {
  const jitterFactor = -0.3 + Math.random() * 0.8; // −0.3 … +0.5
  const jittered = baseDelayMs * (1 + jitterFactor);
  return Math.max(3000, Math.round(jittered));
}
