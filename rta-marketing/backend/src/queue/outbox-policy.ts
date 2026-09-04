export function outboxRetryDelaySeconds(attemptCount: number): number {
  const safeAttempt = Math.max(1, Math.floor(attemptCount));
  return Math.min(300, 5 * (2 ** Math.min(safeAttempt - 1, 6)));
}
