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
 * Sleep for specified milliseconds. Rejects with 'AbortError' if signal is aborted.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); }, { once: true });
  });
}

/**
 * Sleeps for specified milliseconds, calling onTick with remaining seconds every second.
 * Rejects with 'AbortError' if signal is aborted.
 */
export function sleepWithCountdown(
  ms: number,
  onTick: (remaining: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const end = Date.now() + ms;
    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
    const tick = () => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      if (remaining <= 0) {
        signal?.removeEventListener('abort', onAbort);
        onTick(0);
        resolve();
      } else {
        onTick(remaining);
        timer = setTimeout(tick, 1000);
      }
    };
    tick();
  });
}
