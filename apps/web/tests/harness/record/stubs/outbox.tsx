// Stand-in for the outbox: the scenario decides what is queued, and what the person does to it is recorded.
import type { ReactNode } from "react";
type H = { outbox: { supported: boolean; entries: unknown[]; online: boolean; sending: boolean }; calls: Array<[string, unknown[]]> };
const h = () => (window as unknown as { __h: H }).__h;
export function useOutbox() {
  const o = h().outbox;
  return {
    ...o,
    enqueue: async (e: unknown) => { h().calls.push(["outbox.enqueue", [e]]); },
    sendNow: async () => { h().calls.push(["outbox.sendNow", []]); },
    retry: async (id: string) => { h().calls.push(["outbox.retry", [id]]); },
    discard: async (id: string) => { h().calls.push(["outbox.discard", [id]]); },
  };
}
export function OutboxProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
