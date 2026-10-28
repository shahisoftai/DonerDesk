// One router object for the page's life, like Next's: a new object per call would change every hook's dependencies on every render.
const router = {
  refresh: () => { (window as unknown as { __h: { refreshes: number } }).__h.refreshes += 1; },
  push: () => undefined,
  replace: () => undefined,
};
export function useRouter() { return router; }
