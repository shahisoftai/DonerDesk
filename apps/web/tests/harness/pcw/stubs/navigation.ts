// A router that tells the harness page where the app would have gone (a new draft), like the app's pages do.
type H = { navigate: (url: string) => void };
const router = { push: (url: string) => (window as unknown as { __h: H }).__h.navigate(url), replace: (url: string) => (window as unknown as { __h: H }).__h.navigate(url), refresh: () => undefined };
export function useRouter() { return router; }
