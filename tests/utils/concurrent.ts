import { expect } from 'vitest';

/**
 * Fires `n` concurrent calls to `fn`, returns array of settled results.
 * All calls start simultaneously.
 */
export async function raceN<T>(
  n: number,
  fn: () => Promise<T>
): Promise<PromiseSettledResult<T>[]> {
  const promises: Promise<T>[] = [];
  for (let i = 0; i < n; i++) {
    promises.push(fn());
  }
  return Promise.allSettled(promises);
}

/**
 * Adds a random delay between 0 and `jitterMs` milliseconds before calling `fn`.
 */
export async function withJitter<T>(fn: () => Promise<T>, jitterMs: number): Promise<T> {
  const delay = Math.random() * jitterMs;
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
  return fn();
}

/**
 * Asserts that exactly 1 result among the settled results is fulfilled (status === 'fulfilled').
 * Throws if count !== 1.
 */
export function assertOnlyOneSucceeded(results: PromiseSettledResult<unknown>[]): void {
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  expect(fulfilled).toHaveLength(1);
}

/**
 * Asserts that all results are fulfilled (none rejected).
 */
export function assertAllSucceeded(results: PromiseSettledResult<unknown>[]): void {
  const rejected = results.filter((r) => r.status === 'rejected');
  if (rejected.length > 0) {
    const reasons = rejected.map((r) => (r as PromiseRejectedResult).reason);
    throw new Error(
      `Expected all results to succeed, but ${rejected.length} failed: ${JSON.stringify(reasons)}`
    );
  }
  expect(rejected).toHaveLength(0);
}

/**
 * Polls `getter` until the return value deeply equals `expected` or `timeoutMs` elapses.
 * Throws if the expected value is never reached within the timeout.
 */
export async function assertEventualConsistency<T>(
  getter: () => Promise<T>,
  expected: T,
  timeoutMs: number
): Promise<void> {
  const start = Date.now();
  let last: T | undefined;
  while (Date.now() - start < timeoutMs) {
    last = await getter();
    if (JSON.stringify(last) === JSON.stringify(expected)) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  expect(last).toEqual(expected);
}
