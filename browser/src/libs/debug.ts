export function isDebug(): boolean {
  try {
    return typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('debug');
  } catch {
    return false;
  }
}

export function dlog(...args: any[]): void {
  if (isDebug()) {
    // eslint-disable-next-line no-console
    console.debug(...args);
  }
}