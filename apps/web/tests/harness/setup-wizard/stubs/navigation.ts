// A router that moves the harness page between "new setup" and "setup n", like the app's pages do, and counts refreshes.
type H = { navigate: (url: string) => void; refresh: () => void; refreshes: number };
const h = () => (window as unknown as { __h: H }).__h;
const router = {
  refresh: () => { h().refreshes += 1; h().refresh(); },
  push: (url: string) => h().navigate(url),
  replace: (url: string) => h().navigate(url),
};
export function useRouter() { return router; }
