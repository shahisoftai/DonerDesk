// A router that only counts refreshes, on window.__refreshes.
const w = window as unknown as { __refreshes?: number };
const router = {
  refresh: () => { w.__refreshes = (w.__refreshes ?? 0) + 1; },
  push: () => {},
  replace: () => {},
};
export function useRouter() { return router; }
