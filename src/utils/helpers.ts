/**
 * Splits an array into chunks of specified size
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/**
 * Sleeps for specified milliseconds, calling onTick with remaining seconds every second
 */
export function sleepWithCountdown(
  ms: number,
  onTick: (remaining: number) => void
): Promise<void> {
  return new Promise<void>(resolve => {
    const end = Date.now() + ms;
    const tick = () => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      if (remaining <= 0) {
        onTick(0);
        resolve();
      } else {
        onTick(remaining);
        setTimeout(tick, 1000);
      }
    };
    tick();
  });
}
