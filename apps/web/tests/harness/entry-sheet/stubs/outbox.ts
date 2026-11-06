export function useOutbox() {
  return { enqueue: async (entry: unknown) => { (window as unknown as { __h: { enqueued: unknown[] } }).__h.enqueued.push(entry); } };
}
