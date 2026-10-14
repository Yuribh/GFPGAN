/**
 * Only the newest request may update the screen. Picking brand A, going back and picking brand B
 * must not let A's late answer fill B's list (the race listed under "to check" in bugs.md).
 */
export function createLatest() {
  let current = 0;
  return {
    async run<T>(work: () => Promise<T>): Promise<{ stale: true } | { stale: false; value: T }> {
      const ticket = ++current;
      const value = await work();
      return ticket === current ? { stale: false, value } : { stale: true };
    },
    cancel() { current++; },
  };
}

/**
 * Ignores taps that arrive while a navigation from the previous tap is still happening (BUG-001):
 * a double tap would otherwise open two screens, or pick an item on the next screen.
 */
export function createTapGuard(windowMs = 400, now: () => number = Date.now) {
  let lockedUntil = -Infinity;
  return {
    take(): boolean {
      const t = now();
      if (t < lockedUntil) return false;
      lockedUntil = t + windowMs;
      return true;
    },
  };
}
