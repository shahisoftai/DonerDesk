/** The parts of the browser's history the guard needs; a plain object in tests. */
export interface HistoryLike {
  pushState(data: unknown, unused: string, url?: string | URL | null): void;
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

/**
 * Calls `decide` with the path a navigation is about to land on, before the browser's address changes. Google's own page view
 * fires from that same history call, so deciding afterwards (when the page has rendered) is too late to keep a private page
 * out of the counts. Returns a function that puts the original calls back.
 */
export function guardHistory(history: HistoryLike, base: string, decide: (path: string) => void): () => void {
  const push = history.pushState;
  const replace = history.replaceState;
  const target = (url?: string | URL | null): string | null => {
    if (url === undefined || url === null) return null;
    try {
      return new URL(String(url), base).pathname;
    } catch {
      return null;
    }
  };
  history.pushState = function (this: HistoryLike, data: unknown, unused: string, url?: string | URL | null) {
    const path = target(url);
    if (path !== null) decide(path);
    return push.call(this, data, unused, url);
  };
  history.replaceState = function (this: HistoryLike, data: unknown, unused: string, url?: string | URL | null) {
    const path = target(url);
    if (path !== null) decide(path);
    return replace.call(this, data, unused, url);
  };
  return () => {
    history.pushState = push;
    history.replaceState = replace;
  };
}
