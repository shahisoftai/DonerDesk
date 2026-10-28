const router = { refresh: () => undefined, push: (to: string) => { (window as unknown as { __pushed: string[] }).__pushed.push(to); }, replace: () => undefined };
export function useRouter() { return router; }
